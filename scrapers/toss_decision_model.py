"""
Toss decision model: given venue archetype + weather + squad composition,
explain/predict whether the toss winner chose to bat or bowl first.

This is treated as descriptive/interpretive rather than a "prediction you'd
bet on" — the point is to surface which factors actually drive the choice
(e.g. "captains bowl first far more often at dew-affected day/night matches
in chase-favoring venues") using real historical data.

Requires venue_clustering.py to have been run first (reads core.venue_clusters).

Usage:
    export DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/psl"
    python toss_decision_model.py
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, log_loss, classification_report

from db import get_engine

QUERY = """
SELECT
    m.match_id,
    s.season_year,
    m.match_date,
    m.toss_decision,
    m.is_day_night,
    vc.archetype_label,
    w.temperature_c,
    w.humidity_pct,
    w.dew_present,
    w.wind_kph,
    -- toss winner's squad composition (starting XI only)
    COALESCE(spin_tw.spinner_count, 0)   AS toss_winner_spinner_count,
    COALESCE(seas_tw.overseas_count, 0)  AS toss_winner_overseas_count,
    -- opponent squad composition
    COALESCE(spin_opp.spinner_count, 0)  AS opponent_spinner_count
FROM raw_cricsheet.matches m
JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
LEFT JOIN core.venue_clusters vc ON vc.venue_id = m.venue_id
LEFT JOIN raw_cricsheet.match_weather w ON w.match_id = m.match_id

-- toss winner's opponent team id
LEFT JOIN LATERAL (
    SELECT CASE WHEN m.toss_winner_team_id = m.team1_id THEN m.team2_id ELSE m.team1_id END AS opp_team_id
) opp ON TRUE

-- Spinner count for the toss winner's XI.
-- NOTE: no `is_starting_xi` filter -- match_squads only ever contains the
-- 11 players who took the field (or 12 with an Impact Player sub, per the
-- squad-size data-quality check in main.py), so there's no wider matchday
-- squad to filter down from. The original query's is_starting_xi column
-- doesn't exist in the schema and this makes the filter unnecessary anyway.
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS spinner_count
    FROM raw_cricsheet.match_squads ms
    JOIN raw_cricsheet.players p ON p.player_id = ms.player_id
    WHERE ms.match_id = m.match_id
      AND ms.team_id = m.toss_winner_team_id
      AND p.bowler_type = 'spin'
) spin_tw ON TRUE

-- Spinner count for the opponent's XI. Same note as above.
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS spinner_count
    FROM raw_cricsheet.match_squads ms
    JOIN raw_cricsheet.players p ON p.player_id = ms.player_id
    WHERE ms.match_id = m.match_id
      AND ms.team_id = opp.opp_team_id
      AND p.bowler_type = 'spin'
) spin_opp ON TRUE

-- Overseas count for the toss winner's XI.
-- NOTE: the original query joined raw_cricsheet.player_season for a
-- season-specific is_overseas flag -- that table doesn't exist anywhere in
-- the schema (it's not in main.py's own row-count/table list). Using
-- players.nationality instead, which does exist and is already surfaced on
-- player.html. This assumes "overseas" == "not Pakistani", which holds for
-- a PSL-only dataset; if the roster ever includes a non-Pakistan-based
-- league this heuristic would need to change to a real home-country lookup.
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS overseas_count
    FROM raw_cricsheet.match_squads ms
    JOIN raw_cricsheet.players p ON p.player_id = ms.player_id
    WHERE ms.match_id = m.match_id
      AND ms.team_id = m.toss_winner_team_id
      AND p.nationality IS DISTINCT FROM 'Pakistan'
) seas_tw ON TRUE

WHERE m.toss_decision IS NOT NULL
  AND m.status = 'completed'
ORDER BY m.match_date;
"""


def load_data(engine):
    df = pd.read_sql(QUERY, engine)
    print(f"Loaded {len(df)} completed matches with a recorded toss decision.")
    missing_cluster = df["archetype_label"].isna().sum()
    if missing_cluster:
        print(f"Warning: {missing_cluster} matches have no venue cluster "
              f"(venue too new / low match count) — dropping them.")
    df = df.dropna(subset=["archetype_label"])
    return df


def time_based_split(df, test_seasons=1):
    seasons_sorted = sorted(df["season_year"].unique())
    test_season_set = set(seasons_sorted[-test_seasons:])
    train_df = df[~df["season_year"].isin(test_season_set)]
    test_df = df[df["season_year"].isin(test_season_set)]
    print(f"Train: seasons {seasons_sorted[:-test_seasons]} ({len(train_df)} matches)")
    print(f"Test:  seasons {sorted(test_season_set)} ({len(test_df)} matches)")
    return train_df, test_df


NUMERIC_FEATURES = [
    "temperature_c", "humidity_pct", "wind_kph",
    "toss_winner_spinner_count", "toss_winner_overseas_count", "opponent_spinner_count",
]
CATEGORICAL_FEATURES = ["archetype_label", "is_day_night", "dew_present"]


def build_pipeline(model):
    preprocessor = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
    ], remainder="passthrough")  # numeric features pass through as-is

    return Pipeline([
        ("preprocess", preprocessor),
        ("model", model),
    ])


def main():
    engine = get_engine()
    df = load_data(engine)

    feature_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    df[NUMERIC_FEATURES] = df[NUMERIC_FEATURES].fillna(df[NUMERIC_FEATURES].median())
    df["dew_present"] = df["dew_present"].fillna(False).astype(str)
    df["is_day_night"] = df["is_day_night"].fillna(False).astype(str)

    train_df, test_df = time_based_split(df, test_seasons=1)

    X_train, y_train = train_df[feature_cols], train_df["toss_decision"]
    X_test, y_test = test_df[feature_cols], test_df["toss_decision"]

    # Baseline: always predict the majority class from training data
    majority_class = y_train.mode()[0]
    baseline_preds = [majority_class] * len(y_test)
    baseline_acc = accuracy_score(y_test, baseline_preds)
    print(f"\nBaseline (always predict '{majority_class}') test accuracy: {baseline_acc:.3f}")

    for name, model in [
        ("Logistic Regression", LogisticRegression(max_iter=1000)),
        ("Random Forest", RandomForestClassifier(n_estimators=300, random_state=42)),
    ]:
        pipe = build_pipeline(model)
        pipe.fit(X_train, y_train)
        preds = pipe.predict(X_test)
        acc = accuracy_score(y_test, preds)
        print(f"\n{name} test accuracy: {acc:.3f}  "
              f"(baseline: {baseline_acc:.3f}, delta: {acc - baseline_acc:+.3f})")
        print(classification_report(y_test, preds))

        if name == "Random Forest":
            # Feature importance for interpretation (the main point of this model)
            ohe = pipe.named_steps["preprocess"].named_transformers_["cat"]
            cat_names = ohe.get_feature_names_out(CATEGORICAL_FEATURES)
            all_names = list(cat_names) + NUMERIC_FEATURES
            importances = pipe.named_steps["model"].feature_importances_
            imp_df = pd.DataFrame({"feature": all_names, "importance": importances})
            imp_df = imp_df.sort_values("importance", ascending=False)
            print("\nTop factors driving toss decision (Random Forest importances):")
            print(imp_df.head(10).to_string(index=False))


if __name__ == "__main__":
    main()

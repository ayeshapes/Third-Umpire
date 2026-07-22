"""
Venue archetype clustering.

Reads raw_cricsheet.v_venue_pitch_profile (already in your schema — it's
computed analytically from real match data, not manual ratings), clusters
venues on {avg_first_innings_score, boundary_pct_of_balls, spin_wicket_pct,
chase_success_pct}, and writes labeled archetypes back to core.venue_clusters
so every downstream model (toss, match outcome, etc.) can just join to it.

Usage:
    export DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/psl"
    python venue_clustering.py
"""
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from db import get_engine

FEATURES = [
    "avg_first_innings_score",
    "boundary_pct_of_balls",
    "spin_wicket_pct",
    "chase_success_pct",
]

MIN_K, MAX_K = 2, 6


def load_venue_profiles(engine):
    query = "SELECT * FROM raw_cricsheet.v_venue_pitch_profile"
    df = pd.read_sql(query, engine)

    before = len(df)
    df = df.dropna(subset=FEATURES)
    dropped = before - len(df)
    if dropped:
        print(f"Dropped {dropped} venue(s) with incomplete profile data "
              f"(likely too few matches played there yet).")

    if len(df) < MIN_K + 1:
        raise RuntimeError(
            f"Only {len(df)} venues with complete profiles — need at least "
            f"{MIN_K + 1} to cluster meaningfully. Add more matches or lower MIN_K."
        )
    return df


def choose_k(X_scaled):
    scores = {}
    max_k = min(MAX_K, len(X_scaled) - 1)
    for k in range(MIN_K, max_k + 1):
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(X_scaled)
        score = silhouette_score(X_scaled, labels)
        scores[k] = score
        print(f"  k={k}: silhouette={score:.3f}")
    best_k = max(scores, key=scores.get)
    print(f"Chosen k={best_k} (highest silhouette score)")
    return best_k


def label_clusters(df, cluster_col="cluster"):
    """
    Auto-label clusters from their centroid characteristics, ranked
    relative to the *other* clusters (not absolute thresholds, since
    'high scoring' is relative to this league's own historical range).
    """
    centroids = df.groupby(cluster_col)[FEATURES].mean()
    ranks = centroids.rank(ascending=True)  # 1 = lowest, k = highest

    labels = {}
    for cluster_id, row in ranks.iterrows():
        score_rank = row["avg_first_innings_score"]
        boundary_rank = row["boundary_pct_of_balls"]
        spin_rank = row["spin_wicket_pct"]
        chase_rank = row["chase_success_pct"]

        n_clusters = len(ranks)
        high_cut = n_clusters - (n_clusters / 3)
        low_cut = n_clusters / 3

        descriptors = []
        if score_rank >= high_cut and boundary_rank >= high_cut:
            descriptors.append("high-scoring")
        elif score_rank <= low_cut:
            descriptors.append("low-scoring")

        if spin_rank >= high_cut:
            descriptors.append("spin-friendly")
        elif spin_rank <= low_cut:
            descriptors.append("pace-friendly")

        if chase_rank >= high_cut:
            descriptors.append("chase-favoring")
        elif chase_rank <= low_cut:
            descriptors.append("defend-favoring")

        label = " / ".join(descriptors) if descriptors else "balanced/neutral"
        labels[cluster_id] = label

    return labels


def write_clusters_table(engine, df):
    out = df[["venue_id", "venue_name", "cluster", "archetype_label"] + FEATURES].copy()
    out.to_sql(
        "venue_clusters",
        engine,
        schema="core",
        if_exists="replace",
        index=False,
    )
    print(f"\nWrote {len(out)} rows to core.venue_clusters")


def main():
    engine = get_engine()

    print("Loading venue profiles...")
    df = load_venue_profiles(engine)
    print(f"{len(df)} venues with complete profiles.\n")

    X_scaled = StandardScaler().fit_transform(df[FEATURES])

    print("Selecting k via silhouette score:")
    k = choose_k(X_scaled)

    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    df["cluster"] = km.fit_predict(X_scaled)

    label_map = label_clusters(df)
    df["archetype_label"] = df["cluster"].map(label_map)

    print("\nCluster summary:")
    summary = df.groupby(["cluster", "archetype_label"])[FEATURES].mean().round(1)
    print(summary)

    print("\nVenue -> archetype:")
    print(df[["venue_name", "cluster", "archetype_label"]].sort_values("cluster").to_string(index=False))

    write_clusters_table(engine, df)


if __name__ == "__main__":
    main()

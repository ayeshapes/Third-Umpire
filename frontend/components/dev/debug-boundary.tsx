"use client";

import { Component, type ReactNode } from "react";

interface DebugBoundaryProps {
  name: string;
  children: ReactNode;
}

interface DebugBoundaryState {
  hasError: boolean;
}

export class DebugBoundary extends Component<DebugBoundaryProps, DebugBoundaryState> {
  state: DebugBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[DebugBoundary:${this.props.name}] caught:`, error);
    console.error(`[DebugBoundary:${this.props.name}] component stack:`, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ border: "2px solid red", padding: 8, color: "red" }}>
          [{this.props.name}] threw — see console
        </div>
      );
    }
    return this.props.children;
  }
}
---
name: vercel-react-best-practices
description: >-
  Enforce modern React 18/19 patterns, bundle optimization, efficient state management,
  avoiding layout thrashing, and high-performance client rendering.
---

# React Best Practices (Vercel Labs)

Guidelines for building fast, composable, and resilient React web applications.

## Core Directives

1. **State Management & 60FPS Budget:**
   - Keep state local to where it is consumed. Avoid global store bloat.
   - For high-frequency events (streaming data, WebSocket updates, mousemove, scroll), use `useRef` or Web Workers to buffer data, and batch state updates with `requestAnimationFrame`.

2. **Component Composition:**
   - Prefer compound components and children slots over deeply nested boolean props.
   - Separate presentational UI from data-fetching and side effects.

3. **Hook Hygiene & Cleanup:**
   - Every `useEffect` that binds an event listener, initiates an interval, or opens a WebSocket MUST return an explicit cleanup function.
   - Use `AbortController` to cancel in-flight HTTP requests when components unmount.

4. **Bundle & Asset Optimization:**
   - Dynamically import heavy interactive widgets or GIS mapping libraries (`React.lazy`).
   - Use SVG vector icons instead of loading massive monolithic icon fonts.


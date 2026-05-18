# React Best Practices & Style Guide

This document outlines recommended patterns and styles for building React applications with functional components and hooks.

## 1. Components
- **Functional Components**: Prefer functional components with Hooks over class components.
- **Naming**: Use `PascalCase` for component filenames and function names (e.g., `UserProfile.tsx`).
- **One Component per File**: Each file should export exactly one primary component.
- **Props**:
  - Use TypeScript interfaces/types for prop definitions.
  - Destructure props in the function signature for clarity.
  - Provide default values using ES6 default parameters.

## 2. Hooks
- **Rules of Hooks**: Follow the official rules (only call at top level, only in React functions).
- **Custom Hooks**: Extract complex logic into custom hooks (`useSomeLogic`). Name them with the `use` prefix.
- **Dependencies**: Be exhaustive with dependency arrays in `useEffect`, `useMemo`, and `useCallback`.

## 3. Styling
- **CSS-in-JS / Modules**: Prefer CSS Modules or a utility-first framework like Tailwind CSS over global CSS.
- **Conditional Classes**: Use a utility like `clsx` or `classnames` for managing conditional class strings.

## 4. State Management
- **Local State**: Use `useState` for simple, component-specific state.
- **Complex State**: Use `useReducer` for more complex state logic or when state transitions depend on previous state.
- **Context API**: Use `useContext` for sharing state that is "global" to a tree of components (e.g., theme, user session).

## 5. Patterns
- **Container/Presenter**: While less strict now, keep data fetching/logic separate from pure presentation components where it improves testability.
- **Composition**: Prefer component composition (`children` prop) over deep prop drilling.
- **Early Returns**: Use early returns for conditional rendering (e.g., loading or error states).

## 6. Performance
- **useMemo/useCallback**: Use sparingly. Only memoize when profiling shows a performance bottleneck or when passing objects/functions to memoized child components.
- **Fragment**: Use `<React.Fragment>` or `<>` to avoid unnecessary DOM nodes.

*Source: [Official React Documentation](https://react.dev/)*

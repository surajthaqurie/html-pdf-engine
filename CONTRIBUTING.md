# Contributing to html-pdf-engine

First off, thank you for considering contributing to `html-pdf-engine`!

---

## Development Setup

1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/surajthaqurie/html-pdf-engine.git
   cd html-pdf-engine
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build the Project**:
   ```bash
   npm run build
   ```

4. **Run Unit Tests**:
   ```bash
   npm test
   ```

---

## Coding Guidelines

- Written strictly in **TypeScript** using NodeNext module resolution.
- Zero runtime dependencies policy (`dependencies` in `package.json` must remain empty).
- All new features or layout bugfixes must include corresponding unit tests in `tests/`.

---

## Pull Request Workflow

1. Create a feature branch (`git checkout -b feature/my-feature`).
2. Commit your changes following clear commit messages.
3. Verify that `npm run build` and `npm test` pass without warnings.
4. Submit a Pull Request targeting the `main` branch.

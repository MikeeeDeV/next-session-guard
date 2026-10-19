# Accessibility Statement for Next-Session-Guard ♿

**Next-Session-Guard** is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards to our user-facing and administrative React components.

---

## 🎯 Conformance Status

Our user-facing component (`<ActiveSessionsCard />`) and security administrator panel (`<AdminSecurityPanel />`) strive to conform to the **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA** standards.

---

## 🛡️ Accessibility Features

1. **Semantic HTML:**
   - Interactive controls utilize native semantic elements (`<button>`, `<a>`, `<input>`, `<select>`) rather than unsemantic `<div>` elements with click handlers.
   - Appropriate heading hierarchies (`<h1>` - `<h4>`) are maintained across components.

2. **Keyboard Navigation:**
   - All interactive elements are fully reachable and operable using keyboard navigation alone (`Tab`, `Shift + Tab`, `Enter`, `Space`, `Escape`).
   - Clear visual focus rings are provided for active and focused states across both dark and light themes.

3. **Color Contrast & Readability:**
   - Text color combinations meet or exceed the WCAG AA minimum contrast ratio of `4.5:1` for normal text and `3:1` for large text.
   - Status indicators (Active, Revoked, Hijacked) use both distinctive color coding and explicit text labels/icons so information is never conveyed by color alone.

4. **Screen Reader Support:**
   - Descriptive `aria-label` and `aria-live` regions are employed for asynchronous status updates, such as real-time Server-Sent Events (SSE) session kicks and database cleanup operations.
   - Device and browser icons include accessible alternative text or hidden labels for assistive technologies.

5. **Internationalization & RTL Support:**
   - Full native Right-to-Left (RTL) support when configured with `locale="ar"`.
   - Text direction and layout automatically adapt to the user's reading flow without breaking keyboard tab order.

---

## 💻 Supported Environments

Our components are tested across modern browsers and assistive technologies:
- **Browsers:** Chrome, Firefox, Safari, Edge
- **Screen Readers:** NVDA (Windows), VoiceOver (macOS / iOS), TalkBack (Android)
- **Frameworks:** Next.js 14, 15, and 16 with React 18 & 19

---

## 📢 Feedback & Reporting Barriers

We welcome your feedback on the accessibility of Next-Session-Guard. If you encounter accessibility barriers, please let us know:

- **Email:** alsghyrblhh@gmail.com (Mohamed Ayman)
- **GitHub Issues:** [Open an Issue](https://github.com/MikeeeDeV/next-session-guard/issues) with the `accessibility` label.

We aim to respond to accessibility feedback within 2 business days and work proactively to resolve reported barriers.

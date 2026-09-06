# Privacy Policy for AI Vision Prompt Generator

**Last updated: September 06, 2026**

AI Vision Prompt Generator ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use our Chrome Extension.

## 1. Information Collection and Use

- **No Personal Data Collection:** AI Vision Prompt Generator does **NOT** collect, store, transmit, or sell any personal data, user credentials, browsing history, or sensitive identity information.
- **Local Operation & BYOK (Bring Your Own Key):** All image processing and prompt requests are dispatched directly from your browser to your selected AI provider (Google Gemini or Groq) using your personal API key. No intermediate proxy servers, telemetry trackers, or proprietary logging databases are used.
- **Local Storage:** All preferences, prompt histories (up to 1,000 entries), and API keys are stored strictly in your browser's local `chrome.storage.local` sandbox.

## 2. Permissions Required and Justification

- `activeTab`: Used to access the image element currently being viewed or hovered by the user to capture its source URL or dimensions.
- `scripting`: Used to inject the visual hover button and modal overlays directly into the page.
- `storage`: Used to persist user settings, API keys, and prompt generation history locally.
- `contextMenus`: Enables right-click context menu shortcuts for generating prompts from any image.
- `alarms`: Used to schedule local maintenance intervals for quota sync and history retention.

## 3. Data Security

Since the extension runs natively on your machine and connects only to the official AI provider endpoints via HTTPS, your data and API credentials remain confidential and secure on your local device.

## 4. Changes to This Privacy Policy

We may update our Privacy Policy periodically. Any updates will be posted directly within this repository.

## 5. Contact Us

If you have questions or feedback regarding this Privacy Policy, please open an issue in the official GitHub repository.

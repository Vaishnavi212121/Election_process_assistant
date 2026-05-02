# Election Process Education Assistant

## Overview
This project is an interactive, AI-powered **Election Process Education Assistant**. The application serves as a smart, dynamic guide designed to educate users about democratic election processes in an engaging and accessible manner.

## Chosen Vertical
**Civic Education & Election Process**

The assistant specifically focuses on guiding users through the complex, multi-stage process of democratic elections, ensuring citizens have clear, neutral, and factual information about their civic duties and rights.

## Approach & Logic
The solution is built as a highly responsive, single-page application utilizing modern web technologies (Vanilla HTML/CSS/JS) to ensure it is lightweight, fast, and accessible without the need for complex backend dependencies. 

Key logical decisions:
1. **Interactive Timeline:** A 9-phase dynamic timeline (from Voter Registration to Transition of Power) allows users to explore specific parts of the election process linearly or jump straight to topics of interest.
2. **Context-Aware Widgets:** As the user interacts with different phases on the timeline, the application updates its internal state. This logic dynamically populates the UI with contextually relevant data, such as:
   - **Upcoming Deadlines** (Calendar Widget logic)
   - **Live Civic Updates** (News Feed Widget logic)
3. **AI-Powered Chat:** By integrating a Large Language Model (LLM), the assistant can handle complex edge cases and specific user questions that a rigid FAQ could not cover.

## How the Solution Works
1. **Multi-Model Integration:** The application securely accepts a user-provided API key through its Settings widget. It defaults to the **Google Gemini API** (`gemini-1.5-flash`), leveraging Google Services directly from the browser for lightning-fast inference without CORS restrictions. It also provides an option to use the Anthropic API.
2. **Dynamic UI Rendering:** The JavaScript listens for phase changes and uses a predefined data structure to immediately inject relevant deadlines and news articles into the DOM.
3. **Markdown Parsing:** The assistant's responses are intercepted and parsed locally to render clean HTML, allowing for structured bullet points and bold text within the chat bubbles.

## Assumptions Made
- **API Security:** It is assumed that this is an educational/demo tool; hence, API keys are entered directly in the browser by the user per-session and are not stored permanently. For a full production rollout, these requests would be proxied through a secure backend.
- **Mock Data for Widgets:** Due to the scope of the challenge, the Calendar deadlines and News feed articles are simulated with mock data triggered by the timeline state, rather than fetching from live external databases.
- **Google Services Availability:** It is assumed the user has access to a Google AI Studio/Gemini API key to fully test the Google Services integration logic.

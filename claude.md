# Athlete Nutrition Analyzer — Project Brief

## Project Overview

Build a mobile-first web application that allows a young soccer athlete to photograph their meal and receive a detailed nutritional breakdown tailored to their sport. The app uses the Anthropic Claude API (vision) to identify food items and estimate nutrition, then presents the results in a clear, encouraging, athlete-friendly UI. The applicaiton will eventually need to understand the player's 

---

## Target User

- A young soccer player (teen/young adult)
- Uses the app on an iPhone via mobile Safari
- Wants quick, actionable feedback on whether their meals support their training and performance
- Should feel motivating and educational, not clinical or restrictive

---

## Core Features

### MVP (Build First)
1. **Camera / Photo Input** — File input (`<input type="file" accept="image/*" capture="environment">`) to capture a meal photo or select from library
2. **Nutritional Analysis** — Send the image to the Claude API and receive a structured breakdown
3. **Results Display** — Show macronutrients, key vitamins/minerals, and soccer-specific feedback
4. **Meal Context Input** — Optional text field for the user to describe timing (e.g., "pre-match", "post-training", "rest day")

### Post-MVP (Implement After Core Flow Works)
- Meal history log (localStorage)
- Training calendar awareness
- Daily nutrition tracker / running totals
- Hydration reminders
- Match-day vs. training-day mode
- Shareable meal summary card
- Authentication
  - History, tracker, totals, etc. stored in a database

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Vanilla HTML/CSS/JS** (single file to start) or **React (Vite)** | Keep it simple; upgrade to React if state complexity grows |
| Styling | **Tailwind CSS** (CDN) | Rapid mobile-first UI |
| API | **Anthropic Claude API** (`claude-sonnet-4-20250514`) | Vision + nutrition knowledge |
| Hosting | **Vercel** | Free tier, auto HTTPS (required for camera on iOS) |
| Storage | **localStorage** | Meal history, no backend needed for MVP |
| Version Control | **Github** |


---

## Project Structure

```
nutrition-analyzer/
├── index.html          # Main app shell
├── app.js              # Core logic (image capture, API calls, rendering)
├── styles.css          # Custom styles beyond Tailwind
├── api/
│   └── analyze.js      # Serverless function to proxy Anthropic API calls (keeps key secret)
├── components/
│   ├── camera.js       # Image capture logic
│   ├── results.js      # Nutrition results renderer
│   └── history.js      # Meal log (post-MVP)
├── assets/
│   └── icons/
├── .env.local          # ANTHROPIC_API_KEY (never commit)
├── .gitignore
├── vercel.json         # Routing config for serverless functions
└── CLAUDE.md           # This file
```

> **Note:** The Anthropic API key must **never** be exposed in client-side code. Route all API calls through a serverless function (e.g., `api/analyze.js` on Vercel).

---

## API Integration

### Endpoint
```
POST https://api.anthropic.com/v1/messages
```

### Model
```
claude-sonnet-4-20250514
```

### Image Handling
- Accept JPEG/PNG from file input
- Convert to base64 in the browser before sending to the serverless proxy
- Pass as `type: "image"` content block in the messages array

### System Prompt (use this exactly)

```
You are a sports nutrition assistant helping a young soccer athlete understand the nutritional content of their meals.

When given a food image, respond ONLY with a valid JSON object in this exact structure — no markdown, no explanation outside the JSON:

{
  "meal_title": "Brief descriptive name for the meal",
  "foods_identified": ["item1", "item2"],
  "confidence": "high | medium | low",
  "calories": { "estimate": 000, "range": "000–000" },
  "macronutrients": {
    "protein_g": 0,
    "carbohydrates_g": 0,
    "fat_g": 0,
    "fiber_g": 0,
    "sugar_g": 0
  },
  "micronutrients": {
    "vitamin_c_mg": 0,
    "vitamin_d_iu": 0,
    "calcium_mg": 0,
    "iron_mg": 0,
    "potassium_mg": 0,
    "magnesium_mg": 0,
    "sodium_mg": 0,
    "b12_mcg": 0,
    "folate_mcg": 0
  },
  "hydration_note": "Any notable water content or hydration considerations",
  "soccer_performance_rating": {
    "score": 0,
    "out_of": 10,
    "summary": "One sentence on how well this meal supports soccer performance"
  },
  "meal_timing_feedback": {
    "pre_match": "...",
    "post_match": "...",
    "rest_day": "..."
  },
  "what_this_meal_does_well": ["strength 1", "strength 2"],
  "what_to_add_next_time": ["suggestion 1", "suggestion 2"],
  "disclaimer": "Estimates are based on visual analysis. For precise tracking, consult a registered sports dietitian."
}
```

### User Message Structure
```javascript
{
  role: "user",
  content: [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: "<base64string>"
      }
    },
    {
      type: "text",
      text: "Meal context: [pre-match | post-training | rest day | not specified]"
    }
  ]
}
```

---

## UI Design Guidelines

### Tone & Feel
- Energetic and positive — like a supportive coach, not a nutritionist clipboard
- Use soccer metaphors where natural ("This meal is a solid assist for your recovery")
- Avoid language that could encourage disordered eating (no "too many calories", focus on what to ADD)
- Start with black/dark color palette

### Mobile-First Layout
1. **Header** — App name + tagline
2. **Capture Zone** — Large camera button, prominent and tap-friendly
3. **Context Selector** — Pre-match / Post-match / Pre-training / Post-training / Rest day / Just curious (pill buttons)
4. **Loading State** — Animated indicator while API processes ("Analyzing your meal...")
5. **Results Card** — Scrollable, sections for:
   - Foods identified
   - Macro ring chart (visual)
   - Key micronutrients (highlight iron, calcium, vitamin D for young athletes)
   - Soccer performance rating (star or score display)
   - Strengths + suggestions
6. **Disclaimer** — Small, non-alarming, at bottom of results

### Accessibility
- Minimum 44px tap targets
- Sufficient color contrast (WCAG AA)
- `aria-labels` on icon-only buttons
- Don't rely on color alone to convey nutrition info

---

## Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=your_key_here
```

---

## Development Notes

- Test camera capture on a **real iPhone in Safari** — simulators are unreliable for camera APIs
- HTTPS is required for camera; use `npx vercel dev` locally or ngrok for device testing
- Parse the Claude response as JSON; include error handling for malformed responses
- Implement a loading/disabled state on the submit button to prevent duplicate API calls
- Image compression before upload is recommended — resize to max 1024px wide before base64 encoding to reduce latency and cost

---

## Getting Started — First Steps for Claude Code

1. Scaffold the project structure above
2. Create the serverless API proxy (`api/analyze.js`) with the system prompt and proper error handling
3. Build the single-page UI with camera input and a mock results view (hardcoded JSON)
4. Wire the camera input → base64 conversion → API call → results render pipeline
5. Style the results card for mobile
6. Deploy to Vercel and test on a real iPhone

---

## Out of Scope (for now)

- User accounts / authentication
- Backend database
- Barcode scanning
- Manual food entry
- Integration with fitness trackers (Apple Health, Garmin, etc.)
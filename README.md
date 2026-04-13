# GlmGrap

Automated Puppeteer script for grabbing GLM Coding Pro yearly subscriptions precisely at 10:00 AM (or whenever available).

## Features
- Headless / Non-headless Chromium automation
- Bypasses basic WebDriver detections
- Auto-login natively with `.env` credentials
- Precisely waits for predefined target times (9:55 login, 9:59 prepare, 10:00 burst)
- Burst grab clicks using high frequency (50ms interval)
- Recovers from `Server Busy` ("访问人数较多") by seamlessly refreshing and navigating back
- Avoids Execution Context destruction issues

## Setup
1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` file from the sample `.env.example`
4. Add your phone number and password inside the `.env` file

```sh
GLM_PHONE=12345678910
GLM_PASSWORD=your_password
```

## Running

**Waiting for Schedule (Normal Mode)**
Automatically starts at 9:55, logging in, prepping, and spamming exactly at 10:00.
```sh
node grab_glm_pro.js
```

**Quick Testing or Later Starts**
Skip all timer intervals to immediately test login, navigation, and purchasing flow.
```sh
node grab_glm_pro.js --quick
```

## Warnings
If logging fails or your connection drops, the script has a fail-over limit (3 tries for login, 200 tries for page refresh looping).

The project requires interaction inside prompt dialogues / login overlays manually if verification slider appears, though the script attempts standard credential passing blindly first.

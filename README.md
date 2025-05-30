# Kamehameha Gesture Detection App

A Dragon Ball Z-inspired web application that uses machine learning to detect hand gestures and trigger Kamehameha attacks! Built with Next.js, TensorFlow.js, and MediaPipe.

## Features

- 🥋 Real-time hand gesture detection using TensorFlow.js and MediaPipe
- ⚡ Dragon Ball Z-themed UI with energy bars and visual effects
- 🎮 Interactive gesture-based gameplay
- 📱 Responsive design that works on desktop and mobile
- 🎨 Custom animations and sound effects

## Technologies Used

- **Next.js** - React framework for web applications
- **TensorFlow.js** - Machine learning in the browser
- **MediaPipe** - Real-time perception pipeline
- **React** - Component-based UI library
- **CSS3** - Animations and styling

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How to Play

1. Allow camera access when prompted
2. Position your hands in front of the camera
3. Perform the Kamehameha charging gesture (hands together)
4. Watch the energy bar fill up
5. Complete the gesture to fire your Kamehameha!

## Project Structure

```
├── components/
│   └── KamehamehaLifeBar.js    # Energy bar UI component
├── lib/
│   ├── kamehamehaDetection.js  # Gesture detection logic
│   ├── kamehamehaEffects.js    # Visual effects
│   ├── utils.js                # Utility functions
│   └── hooks/
│       └── useAnimationFrame.js # Animation hook
├── pages/
│   ├── index.js                # Main page
│   └── kameha/
│       └── index.js           # Kamehameha game page
├── public/
│   ├── charging.m4a           # Sound effects
│   ├── firing.m4a
│   └── goku-dragon-ball.gif   # Dragon Ball assets
└── styles/
    ├── globals.css            # Global styles
    └── Home.module.css        # Component styles
```

## Contributing

Feel free to fork this project and submit pull requests. All contributions are welcome!

## License

This project is for educational and entertainment purposes.

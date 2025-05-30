# Kamehameha Gesture App

**Application de détection de gestes inspirée de Dragon Ball Z** utilisant l'intelligence artificielle pour reconnaître les mouvements en temps réel.

## 🎯 Démo
**Visitez :** [https://kameha.vercel.app/](https://kameha.vercel.app/)

## 🚀 Technologies
- **Next.js** - Framework React pour applications web
- **TensorFlow.js** - Machine learning dans le navigateur  
- **MediaPipe** - Pipeline de perception temps réel
- **React** - Interface utilisateur componentisée

## ⚡ Fonctionnalités
Détection gestuelle temps réel • Animations Kamehameha • Interface thématique DBZ • IA embarquée navigateur

---

*Application web déployée sur Vercel, démontrant l'intégration de l'IA dans des expériences interactives immersives.*

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

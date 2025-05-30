import Head from "next/head";
import Image from 'next/image'
import Link from "next/link";
import { useState } from "react";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [showWalkthrough, setShowWalkthrough] = useState(true);
  return (
    <div className={styles.container}>
      <Head>
        <title>ml-app</title>
        <meta name="description" content="kamehapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.22)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '24px',
          border: '1.5px solid rgba(255, 255, 255, 0.35)',
          padding: '2.5rem 2rem',
          margin: '3rem auto',
          width: '100%',
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'auto',
          minHeight: 'unset',
        }}
      >
        <main style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0 }}>
          <h1 style={{
            fontSize: '2.4rem',
            textAlign: 'center',
            color: '#F85B1A',
            margin: 0,
            textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',

            }}>
            Bienvenue dans la Salle de l’Esprit et du Temps
          </h1>
          <p style={{
            fontSize: '1.5rem',
            color: '#263238',
            textAlign: 'center',
            margin: 0,
            marginTop: '1.2rem',
          }}>
             Une heure ici est equivalent a un an d’entrainement sur Terre. <br/>
             Utilise ta camera pour liberer ton energie. <br/>
             Active le son pour ressentir la puissance du <br/><span className={styles.neonBlue}>Kameha&nbsp;!</span><br/>
          </p>
          
          {/* Walkthrough Checkbox */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '1.5rem',
            marginBottom: '1rem',
            fontSize: '1.1rem',
            color: '#263238'
          }}>
            <input
              type="checkbox"
              id="walkthrough-checkbox"
              checked={showWalkthrough}
              onChange={(e) => setShowWalkthrough(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                marginRight: '0.5rem',
                cursor: 'pointer'
              }}
            />
            <label htmlFor="walkthrough-checkbox" style={{ cursor: 'pointer' }}>
              Afficher le guide 
            </label>
          </div>
          
          <Link 
            href={`/kameha?walkthrough=${showWalkthrough}`}
            style={{
              display: 'inline-block',
              background: 'linear-gradient(90deg, #1976d2 0%, #64b5f6 100%)',
              color: '#fff',
              fontSize: '1.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '999px',
              boxShadow: '0 4px 24px 0 rgba(25, 118, 210, 0.18)',
              border: 'none',
              cursor: 'pointer',
              marginTop: '1.2rem',
              textDecoration: 'none',
              transition: 'background 0.2s, transform 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'linear-gradient(90deg, #1565c0 0%, #42a5f5 100%)'}
            onMouseOut={e => e.currentTarget.style.background = 'linear-gradient(90deg, #1976d2 0%, #64b5f6 100%)'}
          >
               Press start
          </Link>
        </main>
      </div>
    </div>
  );
}

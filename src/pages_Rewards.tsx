// src/pages_Rewards.tsx
import React from 'react';

interface RewardsProps {
  onBack: () => void;
  onEnterApp: () => void;
}

export default function Rewards({ onBack, onEnterApp }: RewardsProps) {
  return (
    <div className="screen rewards">
      <Style />
      <div className="bg-layer" aria-hidden />
      <div className="scrim" aria-hidden />

      <div className="container content">
        <h1 className="title-xxl">🏆 Rewards</h1>

        <div className="card">
          <div className="card-title">Welcome Bonus</div>
          <p className="card-text">
            Head to <strong>“Create Your Team”</strong> to use your £100m budget and start competing.
          </p>
        </div>

        <div className="card">
          <div className="card-title">Weekly Prizes</div>
          <p className="card-text">
            Top-performing managers in weekly contests earn exclusive rewards and tokens.
          </p>
        </div>

        <div className="card">
          <div className="card-title">Seasonal Grand Rewards</div>
          <p className="card-text">
            Finish the season in the top rankings to unlock premium collectibles and FST tokens.
          </p>
        </div>

        <div className="actions">
          <button className="ghost" onClick={onBack}>← Back</button>
          <button className="cta" onClick={onEnterApp}>Continue</button>
        </div>
      </div>
    </div>
  );
}

function Style() {
  return (
    <style>{`
      .rewards {
        position: relative;
        min-height: 100dvh;
        background: #090b10;
        color: #e8edf2;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        padding: 24px;
      }

      .bg-layer {
        position: absolute;
        inset: -20%;
        background:
          radial-gradient(40% 40% at 20% 25%, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.00) 60%),
          radial-gradient(36% 36% at 80% 30%, rgba(236,72,153,0.20) 0%, rgba(236,72,153,0.00) 60%),
          radial-gradient(45% 45% at 50% 85%, rgba(34,197,94,0.20) 0%, rgba(34,197,94,0.00) 60%);
        filter: blur(25px);
        z-index: 0;
        animation: orbMotion 18s ease-in-out infinite alternate;
      }

      @keyframes orbMotion {
        0% { transform: scale(1); }
        100% { transform: scale(1.05) translateY(-2%); }
      }

      .scrim {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(9,11,16,0.0), rgba(9,11,16,0.8) 60%, rgba(9,11,16,1));
        z-index: 1;
      }

      .content {
        position: relative;
        z-index: 2;
        width: 100%;
        max-width: 700px;
        text-align: center;
      }

      .title-xxl {
        font-size: clamp(24px, 5vw, 40px);
        font-weight: 900;
        margin-bottom: 24px;
      }

      .card {
        border: 1px solid rgba(255,255,255,0.15);
        background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
        border-radius: 16px;
        padding: 16px 18px;
        margin-bottom: 16px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        backdrop-filter: blur(6px);
        transition: transform 0.2s ease;
      }

      .card:hover {
        transform: translateY(-2px);
      }

      .card-title {
        font-weight: 800;
        font-size: 18px;
        margin-bottom: 6px;
        color: #cdb8ff;
      }

      .card-text {
        font-size: 15px;
        color: rgba(232,237,242,0.9);
      }

      .actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 28px;
        flex-wrap: wrap;
      }

      .cta, .ghost {
        appearance: none;
        cursor: pointer;
        border-radius: 14px;
        padding: 10px 16px;
        font-weight: 900;
        transition: transform 0.1s ease;
      }

      .cta {
        border: 1px solid rgba(255,255,255,0.22);
        background: linear-gradient(135deg, rgba(99,102,241,0.85), rgba(236,72,153,0.85));
        color: #fff;
      }

      .ghost {
        color: #fff;
        border: 1px solid rgba(255,255,255,0.18);
        background: linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
      }

      .cta:active, .ghost:active {
        transform: translateY(1px);
      }
    `}</style>
  );
}

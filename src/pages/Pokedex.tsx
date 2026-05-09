// Pokedex page. Owns: compass instance, view-mode state, banner /
// flash / error / completion UI state. Wires the XR8 pipeline + camera shutter.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { Compass } from "../adapters/compass.ts";
import { bootXR } from "../adapters/xr.ts";
import { catchCurrent } from "../features/catch.ts";
import { capturePhoto } from "../features/photo.ts";
import { useCompassState } from "../hooks/useCompass.ts";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Content } from "../components/Content";
import { StartView } from "../components/StartView";
import { CompletionView } from "../components/CompletionView";
import { EmptyHunt } from "../components/EmptyHunt";
import { Hud } from "../components/Hud";
import { MapView } from "../components/MapView";
import { SPAWNS } from "../data/spawns.ts";
import s from "../app.module.scss";

const AR_DISTANCE_M = 20;

// 8th Wall reads window.THREE on init.
(window as any).THREE = THREE;

type Phase = "start" | "running" | "completed";

export function Pokedex() {
  const navigate = useNavigate();
  const compassRef = useRef<Compass | null>(null);
  if (!compassRef.current) compassRef.current = new Compass();
  const compass = compassRef.current;

  const [phase, setPhase] = useState<Phase>("start");
  const [notification, setNotification] = useState("");
  const [flashing, setFlashing] = useState(false);

  const [foundTick, setFoundTick] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const compassState = useCompassState(compass);

  const showNotification = (text: string) => setNotification(text);

  useEffect(() => {
    compass.onEnterRadius = (s) => {
      if (typeof navigator.vibrate === "function") navigator.vibrate(50);
      showNotification(`${s.name.toUpperCase()} BINNEN BEREIK`);
    };
    compass.onLeaveRadius = (s) => {
      showNotification(`${s.name.toUpperCase()} BUITEN BEREIK`);
    };
    compass.onError = (code) => {
      showNotification(
        `Kon niet starten: ${code}. Herlaad en geef toestemming.`,
      );
      setPhase("start");
    };
    return () => {
      compass.onEnterRadius = null;
      compass.onLeaveRadius = null;
      compass.onError = null;
    };
  }, [compass]);

  const fatal = (message: string) => {
    showNotification(message);
    setPhase("start");
  };

  const onStart = () => {
    setPhase("running");
    compass
      .start()
      .then(() => {
        if (canvasRef.current) bootXR(compass, canvasRef.current, fatal);
      })
      .catch((e: unknown) => {
        console.warn("[hunt] start failed", e);
        showNotification(
          "Kon safari niet starten. Controleer toestemmingen en herlaad.",
        );
        setPhase("start");
      });
  };

  const onShutter = async () => {
    const target = compass.state().target;
    const canvas = canvasRef.current;
    if (!target || !canvas) return;
    if (typeof navigator.vibrate === "function") navigator.vibrate(20);
    setFlashing(true);
    window.setTimeout(() => setFlashing(false), 150);
    try {
      await capturePhoto(canvas, target);
    } catch (e) {
      console.warn("[hunt] capture failed", e);
      showNotification("Foto mislukt — probeer opnieuw");
      return;
    }
    catchCurrent(compass, {
      onBanner: showNotification,
      onComplete: (ms) => {
        setElapsedMs(ms);
        setPhase("completed");
      },
      onCaught: () => setFoundTick((n) => n + 1),
    });
  };

  const onReplay = () => {
    compass.reset();
    setFoundTick((n) => n + 1);
    setPhase("running");
  };

  const showMap =
    compassState.distance === undefined ||
    compassState.distance >= AR_DISTANCE_M;
  const arRunning = phase === "running" || phase === "completed";
  const hasHunt = SPAWNS.length > 0;

  return (
    <div className={s.app}>
      <Header
        foundCount={arRunning ? compassState.foundCount : undefined}
        total={arRunning ? compassState.total : undefined}
        onLensLongPress={() => navigate("/admin")}
      />
      <Content>
        {!hasHunt && <EmptyHunt />}

        {hasHunt && arRunning && (
          <>
            <canvas id="camerafeed" ref={canvasRef} className={s.canvas} />
            <MapView
              state={compassState}
              spawns={SPAWNS}
              found={compass.found}
              visible={showMap}
              key={foundTick}
            />
            <Hud
              state={compassState}
              visible={!showMap}
              onShutter={onShutter}
            />
            {flashing && <div className={s.flash} />}
          </>
        )}

        {hasHunt && phase === "start" && <StartView onStart={onStart} />}

        {hasHunt && phase === "completed" && (
          <CompletionView elapsedMs={elapsedMs} onReplay={onReplay} />
        )}
      </Content>
      <Footer state={compassState} notification={notification} />
    </div>
  );
}

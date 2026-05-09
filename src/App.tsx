// Top-level component. Owns: compass instance, view-mode state, banner /
// flash / error / completion UI state. Wires the XR8 pipeline + canvas tap.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Compass } from "./adapters/compass.ts";
import { bootXR } from "./adapters/xr.ts";
import { attachCanvasTap } from "./features/catch.ts";
import { useCompassState } from "./hooks/useCompass.ts";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Content } from "./components/Content";
import { StartView } from "./components/StartView";
import { CompletionView } from "./components/CompletionView";
import { ErrorView } from "./components/ErrorView";
import { CatchFlash } from "./components/CatchFlash";
import { Hud } from "./components/Hud";
import { MapView } from "./components/MapView";
import s from "./app.module.scss";

const AR_DISTANCE_M = 20;

// 8th Wall reads window.THREE on init.
(window as any).THREE = THREE;

type Phase = "start" | "running" | "completed" | "error";

export function App() {
  const compassRef = useRef<Compass | null>(null);
  if (!compassRef.current) compassRef.current = new Compass();
  const compass = compassRef.current;

  const [phase, setPhase] = useState<Phase>("start");
  const [errorMsg, setErrorMsg] = useState("");
  const [notification, setNotification] = useState("");
  const [flashOn, setFlashOn] = useState(false);
  const [foundTick, setFoundTick] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const compassState = useCompassState(compass);

  const showNotification = (text: string) => setNotification(text);

  useEffect(() => {
    compass.onEnterRadius = (s) => {
      if (typeof navigator.vibrate === "function") navigator.vibrate(50);
      showNotification(`${s.name.toUpperCase()} ENTERED RANGE`);
    };
    compass.onLeaveRadius = (s) => {
      showNotification(`${s.name.toUpperCase()} LEFT RANGE`);
    };
    compass.onError = (code) => {
      setErrorMsg(`Couldn't start: ${code}. Reload and grant permissions.`);
      setPhase("error");
    };
    return () => {
      compass.onEnterRadius = null;
      compass.onLeaveRadius = null;
      compass.onError = null;
    };
  }, [compass]);

  const fatal = (message: string) => {
    setErrorMsg(message);
    setPhase("error");
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
        if (phase !== "error") {
          setErrorMsg(
            `Couldn't start the hunt. Check your permissions and reload.`,
          );
          setPhase("error");
        }
      });
  };

  useEffect(() => {
    if (phase !== "running" || !canvasRef.current) return;
    const off = attachCanvasTap(canvasRef.current, compass, {
      onFlash: () => {
        setFlashOn(true);
        if (typeof navigator.vibrate === "function")
          navigator.vibrate([40, 60, 40, 60, 40]);
        setTimeout(() => setFlashOn(false), 220);
      },
      onBanner: showNotification,
      onComplete: (ms) => {
        setElapsedMs(ms);
        setPhase("completed");
      },
      onCaught: () => setFoundTick((n) => n + 1),
    });
    return off;
  }, [phase, compass]);

  const onReplay = () => {
    compass.reset();
    setFoundTick((n) => n + 1);
    setPhase("running");
  };

  const showMap =
    compassState.distance === undefined ||
    compassState.distance >= AR_DISTANCE_M;
  const arRunning = phase === "running" || phase === "completed";

  return (
    <>
      {/* Camera canvas at the root, BEFORE .app, so it paints first and the
          (transparent) .app paints on top. XR8's FullWindowCanvas module
          sets it to fixed full-window; header/footer/side borders cover
          the strips we don't want camera visible through. */}
      <canvas id="camerafeed" ref={canvasRef} className={s.canvas} />

      <div className={s.app}>
        <Header
          foundCount={arRunning ? compassState.foundCount : undefined}
          total={arRunning ? compassState.total : undefined}
        />

        <Content>
          {arRunning && (
            <>
              <MapView
                state={compassState}
                found={compass.found}
                visible={showMap}
                key={foundTick}
              />
              <Hud state={compassState} visible={!showMap} />
            </>
          )}

          <CatchFlash active={flashOn} />

          {phase === "start" && <StartView onStart={onStart} />}

          {phase === "completed" && (
            <CompletionView elapsedMs={elapsedMs} onReplay={onReplay} />
          )}
        </Content>

        <Footer state={compassState} notification={notification} />
        {phase === "error" && <ErrorView message={errorMsg} />}
      </div>
    </>
  );
}

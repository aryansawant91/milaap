"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type CameraStatus = { camera_name: string; running: boolean };

const CAMERAS = [
  { id: 1, name: "Z1-C1 — Zone 1", video_path: "/content/1643-148614430_medium.mp4" },
  { id: 2, name: "Z1-C2 — Zone 1", video_path: "/content/39837-424360872_medium.mp4" },
  { id: 3, name: "Z1-C3 — Zone 1", video_path: "/content/123232-727221558.mp4" },
];

// Fetches MJPEG stream with ngrok header (plain <img> can't send headers)
function MjpegFeed({ cameraId }: { cameraId: number }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let active = true;
    const base = process.env.NEXT_PUBLIC_API_BASE;

    async function readStream() {
      try {
        const res = await fetch(`${base}/cameras/${cameraId}/stream`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        const reader = res.body!.getReader();
        let buf = new Uint8Array(0);

        const JPEG_START = [0xFF, 0xD8];
        const JPEG_END = [0xFF, 0xD9];

        function findSeq(data: Uint8Array, seq: number[], from = 0) {
          for (let i = from; i <= data.length - seq.length; i++) {
            if (seq.every((b, j) => data[i + j] === b)) return i;
          }
          return -1;
        }

        function concat(a: Uint8Array, b: Uint8Array) {
          const c = new Uint8Array(a.length + b.length);
          c.set(a); c.set(b, a.length);
          return c;
        }

        while (active) {
          const { done, value } = await reader.read();
          if (done || !active) break;
          buf = concat(buf, value);

          const start = findSeq(buf, JPEG_START);
          if (start === -1) { buf = new Uint8Array(0); continue; }

          const end = findSeq(buf, JPEG_END, start + 2);
          if (end === -1) continue; // wait for more data

          const jpeg = buf.slice(start, end + 2);
          buf = buf.slice(end + 2);

          const blob = new Blob([jpeg], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          if (imgRef.current) {
            const old = imgRef.current.src;
            imgRef.current.src = url;
            if (old.startsWith('blob:')) URL.revokeObjectURL(old);
          }
        }
        reader.cancel();
      } catch {
        if (active) setTimeout(readStream, 1000);
      }
    }

    readStream();
    return () => { active = false; };
  }, [cameraId]);

  return <img ref={imgRef} alt="" className="w-full h-full object-cover" />;
}
export default function CameraGrid({ limit }: { limit?: number }) {
  const [statuses, setStatuses] = useState<Record<string, CameraStatus>>({});
  const cams = limit ? CAMERAS.slice(0, limit) : CAMERAS;

  const fetchStatus = async () => {
    try {
      const res = await apiFetch("/cameras/status");
      setStatuses(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const startCamera = async (cam: (typeof CAMERAS)[0]) => {
    try {
      const form = new FormData();
      form.append("camera_id", String(cam.id));
      form.append("camera_name", cam.name);
      form.append("video_path", cam.video_path);
      form.append("frame_skip", "10");
      const res = await apiFetch("/cameras/start", { method: "POST", body: form });
      const data = await res.json();
      if (!data.success && data.error !== "Camera already running") {
        console.error("start failed:", data.error);
      }
    } catch (e) {
      console.error("startCamera error:", e);
    }
    setTimeout(fetchStatus, 1500);
  };

  const stopCamera = async (id: number) => {
    try {
      const form = new FormData();
      form.append("camera_id", String(id));
      await apiFetch("/cameras/stop", { method: "POST", body: form });
    } catch (e) {
      console.error("stopCamera error:", e);
    }
    fetchStatus();
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)] diya-glow card-accent parchment-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">📷 Live Camera Feeds</h2>
        <span className="text-xs text-[var(--text-dim)]">
          {Object.values(statuses).filter((s) => s.running).length} of {cams.length} active
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cams.map((cam) => {
          const isRunning = statuses[cam.id]?.running;
          return (
            <div key={cam.id} className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="aspect-video bg-[#1a1510] flex items-center justify-center relative">
                {isRunning ? (
                  <>
                    <MjpegFeed cameraId={cam.id} />
                    <span className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded-full text-xs text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] animate-pulse" /> LIVE
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-[var(--text-dimmer)]">Feed offline</span>
                )}
              </div>
              <div className="p-3 flex items-center justify-between">
                <p className="text-sm font-medium truncate">{cam.name}</p>
                <button
                  onClick={() => (isRunning ? stopCamera(cam.id) : startCamera(cam))}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0 ml-2 ${
                    isRunning
                      ? "bg-[var(--red)]/15 text-[var(--red)] hover:bg-[var(--red)]/25"
                      : "bg-[var(--green)]/15 text-[var(--green)] hover:bg-[var(--green)]/25"
                  }`}
                >
                  {isRunning ? "Stop" : "Start"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function WebcamFeed({ cameraId = 99, cameraName = "Webcam" }: { cameraId?: number; cameraName?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setActive(true);
      setStatus("scanning");

      // Send frame every 500ms
      intervalRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0);
        const frameData = canvas.toDataURL("image/jpeg", 0.8);

        const form = new FormData();
        form.append("camera_id", String(cameraId));
        form.append("camera_name", cameraName);
        form.append("frame_data", frameData);
        apiFetch("/cameras/webcam/frame", { method: "POST", body: form })
          .then(r => r.json())
          .then(data => {
            if (data.matches?.length > 0) setStatus(`Match: ${data.matches[0]}`);
            else setStatus("scanning");
          })
          .catch(() => {});
      }, 500);
    } catch (e) {
      setStatus("Camera access denied");
    }
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setStatus("idle");
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="aspect-video bg-[#1a1510] relative flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        {!active && <span className="absolute text-xs text-[var(--text-dimmer)]">Webcam offline</span>}
        {active && (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded-full text-xs text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> {status}
          </span>
        )}
      </div>
      <div className="p-3 flex items-center justify-between">
        <p className="text-sm font-medium">{cameraName}</p>
        <button
          onClick={active ? stop : start}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0 ml-2 ${
            active
              ? "bg-[var(--red)]/15 text-[var(--red)] hover:bg-[var(--red)]/25"
              : "bg-[var(--green)]/15 text-[var(--green)] hover:bg-[var(--green)]/25"
          }`}
        >
          {active ? "Stop" : "Start"}
        </button>
      </div>
    </div>
  );
}
import confetti from "canvas-confetti";
import { toast } from "sonner";
import api from "./api";

// Subtle "ding" via WebAudio — respects localStorage os_sound flag
function playDing() {
  if (localStorage.getItem("os_sound") !== "on") return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function fireConfetti() {
  const duration = 1400;
  const end = Date.now() + duration;
  const colors = ["#4361EE", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  // Big center burst
  confetti({ particleCount: 90, spread: 80, origin: { x: 0.5, y: 0.4 }, colors, startVelocity: 40 });
}

// Fun XP amounts
const XP_POOL = [25, 30, 40, 50];

export async function celebrateJobDone(jobId, jobTitle) {
  fireConfetti();
  playDing();

  const xp = XP_POOL[Math.floor(Math.random() * XP_POOL.length)];
  toast.success(`+${xp} Vibes — ${jobTitle || "Job done"} shipped 🔥`, {
    duration: 4000,
    className: "os-celebrate-toast",
  });

  // AI congrats — non-blocking, second toast when it arrives
  try {
    const { data } = await api.post("/ai/celebrate", { jobId, kind: "celebrate" });
    if (data?.line) {
      toast(data.line, { duration: 6000, icon: "👑" });
    }
  } catch {
    // silent fallback — the first toast already fired
  }
}

// Central constants: role emoji, colors, avatar URLs

export const ROLE_LABEL = {
  writer: "Writer",
  designer: "Designer",
  mktg: "Digital Mktg",
  webdev: "Web Dev",
  clientsvc: "Client Svc",
  manager: "Manager",
};

export const ROLE_EMOJI = {
  writer: "✍️",
  designer: "🎨",
  mktg: "📊",
  webdev: "💻",
  clientsvc: "🤝",
  manager: "👔",
};

export const ROLE_COLOR = {
  writer: "#10B981",
  designer: "#F59E0B",
  mktg: "#8B5CF6",
  webdev: "#06B6D4",
  clientsvc: "#EF4444",
  manager: "#4361EE",
};

export const STATUS_LABEL = {
  todo: "To Do",
  active: "In Progress",
  review: "In Review",
  done: "Done",
  overdue: "Overdue",
};

export const AVATAR = {
  u_yusuf: "https://ui-avatars.com/api/?name=Yusuf&background=4361EE&color=fff&size=150",
  u_arjun: "https://ui-avatars.com/api/?name=Arjun&background=10B981&color=fff&size=150",
  u_priya: "https://ui-avatars.com/api/?name=Priya&background=F59E0B&color=fff&size=150",
  u_kavya: "https://ui-avatars.com/api/?name=Kavya&background=8B5CF6&color=fff&size=150",
  u_rohan: "https://ui-avatars.com/api/?name=Rohan&background=06B6D4&color=fff&size=150",
  u_meera: "https://ui-avatars.com/api/?name=Meera&background=EF4444&color=fff&size=150",
};

export const avatarFor = (user) => {
  if (!user) return "https://ui-avatars.com/api/?name=U&background=4361EE&color=fff&size=150";
  if (AVATAR[user.id]) return AVATAR[user.id];
  const bg = (ROLE_COLOR[user.role_key] || "#4361EE").replace("#", "");
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "U")}&background=${bg}&color=fff&size=150`;
};

export const fmtINR = (n) => "₹" + (n || 0).toLocaleString("en-IN");
export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};
export const daysUntil = (iso) => {
  if (!iso) return 0;
  const d = new Date(iso);
  const now = new Date();
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
};

export const QUOTES = [
  { emoji: "🚀", text: "Ship it. You can always polish later.", author: "Reid Hoffman" },
  { emoji: "🎯", text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { emoji: "🔥", text: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma" },
  { emoji: "💡", text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { emoji: "⚡", text: "Speed is the ultimate weapon in business.", author: "Elon Musk" },
];

export const XP_LEVEL = (score) => {
  if (score >= 9) return "Expert";
  if (score >= 8) return "Pro";
  if (score >= 7) return "Skilled";
  return "Growing";
};

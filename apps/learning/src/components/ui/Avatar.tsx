import { cx } from "./classNames";

const PALETTE = ["#0b6b5c", "#b98a3d", "#5b7a6e", "#3a5a52", "#8a6a3a"];

export function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cx("flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, background: colorForName(name), fontSize: size * 0.36 }}
    >
      {initialsOf(name)}
    </div>
  );
}

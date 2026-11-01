"use client";

import { useEffect, useRef } from "react";

/**
 * /dev/tiles — Tileset atlas viewer
 *
 * Draws all 132 frames from tilemap.png at 4x scale with index labels.
 * Used to verify frame mapping before writing any number into code.
 *
 * Spritesheet spec (confirmed from Tilesheet.txt):
 *   Tile: 16×16 px, Spacing: 1 px, Sheet: 12 cols × 11 rows = 132 frames
 */

const TILE_W = 16;
const TILE_H = 16;
const SPACING = 1;
const COLS = 12;
const ROWS = 11;
const SCALE = 4;

// Canvas cell size: tile scaled + label area below
const CELL_W = TILE_W * SCALE;
const CELL_H = TILE_H * SCALE + 14; // 14px for label

// Left offset for row labels
const ROW_LABEL_W = 24;
// Top offset for col labels
const COL_LABEL_H = 20;

const CANVAS_W = ROW_LABEL_W + COLS * (CELL_W + 2);
const CANVAS_H = COL_LABEL_H + ROWS * (CELL_H + 2);

export default function TilesDevPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = "/assets/tiny-dungeon/Tilemap/tilemap.png";
    img.onload = () => {
      // Background
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Column headers
      ctx.fillStyle = "#7c7caa";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      for (let c = 0; c < COLS; c++) {
        const cx = ROW_LABEL_W + c * (CELL_W + 2) + CELL_W / 2;
        ctx.fillText(String(c), cx, COL_LABEL_H - 6);
      }

      // Row headers
      ctx.textAlign = "right";
      for (let r = 0; r < ROWS; r++) {
        const cy = COL_LABEL_H + r * (CELL_H + 2) + CELL_W + 6;
        ctx.fillText(String(r), ROW_LABEL_W - 4, cy);
      }

      // Draw each frame
      ctx.imageSmoothingEnabled = false;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const frameIndex = r * COLS + c;

          // Source rect in the spritesheet
          const sx = c * (TILE_W + SPACING);
          const sy = r * (TILE_H + SPACING);

          // Destination on canvas
          const dx = ROW_LABEL_W + c * (CELL_W + 2);
          const dy = COL_LABEL_H + r * (CELL_H + 2);

          // Cell background
          ctx.fillStyle = "#2a2a3e";
          ctx.fillRect(dx, dy, CELL_W, CELL_H);

          // Draw tile at 4x
          ctx.drawImage(
            img,
            sx, sy, TILE_W, TILE_H,
            dx, dy, TILE_W * SCALE, TILE_H * SCALE,
          );

          // Frame index label
          ctx.fillStyle = "#aaaacc";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(
            String(frameIndex),
            dx + CELL_W / 2,
            dy + TILE_H * SCALE + 11,
          );
        }
      }
    };

    img.onerror = () => {
      ctx.fillStyle = "#ff4444";
      ctx.font = "14px monospace";
      ctx.fillText("ERROR: tilemap.png not found", 10, 30);
    };
  }, []);

  return (
    <div
      style={{
        background: "#0d0d1a",
        minHeight: "100vh",
        padding: "16px",
        fontFamily: "monospace",
        color: "#aaaacc",
      }}
    >
      <h1 style={{ fontSize: "14px", marginBottom: "8px", color: "#ffffff" }}>
        Tileset Atlas — tilemap.png (12 cols × 11 rows = 132 frames, 16×16 px, spacing 1 px)
      </h1>
      <p style={{ fontSize: "11px", marginBottom: "16px", color: "#888" }}>
        Skala 4x. Baris = row (0–10), Kolom = col (0–11). Index = row × 12 + col.
        Gunakan halaman ini untuk memverifikasi mapping frame (index → nama).
      </p>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          imageRendering: "pixelated",
          display: "block",
          border: "1px solid #333",
        }}
      />
      <div style={{ marginTop: "16px", fontSize: "11px", color: "#666" }}>
        <p>STATUS: Frame mapping sudah diisi dan diverifikasi visual.</p>
        <p style={{ marginTop: "4px" }}>
          File: <code>game/map/tileFrames.ts</code> — satu-satunya sumber nomor frame.
        </p>
      </div>
    </div>
  );
}

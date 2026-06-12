import React from "react";

export function Logo({ size = 56, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="rounded-full flex items-center justify-center border"
        style={{
          width: size,
          height: size,
          background: "#0A0A0A",
          borderColor: "rgba(197,160,89,0.4)",
        }}
      >
        <span
          className="font-serif text-white"
          style={{ fontSize: size * 0.42, letterSpacing: "0.05em" }}
        >
          L<span style={{ color: "#C5A059" }}>|</span>D
        </span>
      </div>
      <div className="leading-tight">
        <div className="font-serif text-[15px] md:text-[17px] tracking-wide">
          Las Dos Doncellas
        </div>
        <div className="font-script gold text-[14px] md:text-[16px] -mt-1">
          Productos Ibéricos
        </div>
      </div>
    </div>
  );
}

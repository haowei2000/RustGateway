/* Lucide-style icon set (paths reused from the same lucide-react library the
   product bundles) + a tiny <Icon> wrapper. ISC licensed. */
(function () {
  const IC = {
    gauge: [["path", { d: "m12 14 4-4" }], ["path", { d: "M3.34 19a10 10 0 1 1 17.32 0" }]],
    database: [
      ["ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }],
      ["path", { d: "M3 5V19A9 3 0 0 0 21 19V5" }],
      ["path", { d: "M3 12A9 3 0 0 0 21 12" }],
    ],
    shuffle: [
      ["path", { d: "m18 14 4 4-4 4" }], ["path", { d: "m18 2 4 4-4 4" }],
      ["path", { d: "M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" }],
      ["path", { d: "M2 6h1.972a4 4 0 0 1 3.6 2.2" }],
      ["path", { d: "M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" }],
    ],
    keyRound: [
      ["path", { d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" }],
      ["circle", { cx: 16.5, cy: 7.5, r: 0.5, fill: "currentColor" }],
    ],
    layers: [
      ["path", { d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" }],
      ["path", { d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" }],
      ["path", { d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" }],
    ],
    sliders: [
      ["line", { x1: 21, x2: 14, y1: 4, y2: 4 }], ["line", { x1: 10, x2: 3, y1: 4, y2: 4 }],
      ["line", { x1: 21, x2: 12, y1: 12, y2: 12 }], ["line", { x1: 8, x2: 3, y1: 12, y2: 12 }],
      ["line", { x1: 21, x2: 16, y1: 20, y2: 20 }], ["line", { x1: 12, x2: 3, y1: 20, y2: 20 }],
      ["line", { x1: 14, x2: 14, y1: 2, y2: 6 }], ["line", { x1: 8, x2: 8, y1: 10, y2: 14 }],
      ["line", { x1: 16, x2: 16, y1: 18, y2: 22 }],
    ],
    scroll: [
      ["path", { d: "M15 12h-5" }], ["path", { d: "M15 8h-5" }],
      ["path", { d: "M19 17V5a2 2 0 0 0-2-2H4" }],
      ["path", { d: "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" }],
    ],
    plus: [["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }]],
    save: [
      ["path", { d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" }],
      ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }],
      ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7" }],
    ],
    rotateCw: [
      ["path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }],
      ["path", { d: "M21 3v5h-5" }],
    ],
    trash: [
      ["path", { d: "M10 11v6" }], ["path", { d: "M14 11v6" }],
      ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
      ["path", { d: "M3 6h18" }], ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }],
    ],
    search: [["circle", { cx: 11, cy: 11, r: 8 }], ["path", { d: "m21 21-4.3-4.3" }]],
    panelClose: [["rect", { width: 18, height: 18, x: 3, y: 3, rx: 2 }], ["path", { d: "M9 3v18" }], ["path", { d: "m16 15-3-3 3-3" }]],
    panelOpen: [["rect", { width: 18, height: 18, x: 3, y: 3, rx: 2 }], ["path", { d: "M9 3v18" }], ["path", { d: "m14 9 3 3-3 3" }]],
    copy: [
      ["rect", { width: 14, height: 14, x: 8, y: 8, rx: 2, ry: 2 }],
      ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }],
    ],
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    x: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
    activity: [["path", { d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" }]],
    clock: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 6v6l4 2" }]],
    alertTriangle: [
      ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
      ["path", { d: "M12 9v4" }], ["path", { d: "M12 17h.01" }],
    ],
    filter: [["polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" }]],
    chevronDown: [["path", { d: "m6 9 6 6 6-6" }]],
    chevronRight: [["path", { d: "m9 18 6-6-6-6" }]],
    shield: [
      ["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }],
      ["path", { d: "m9 12 2 2 4-4" }],
    ],
    zap: [["path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" }]],
    user: [["circle", { cx: 12, cy: 8, r: 5 }], ["path", { d: "M20 21a8 8 0 0 0-16 0" }]],
    arrowUp: [["path", { d: "m5 12 7-7 7 7" }], ["path", { d: "M12 19V5" }]],
    arrowDown: [["path", { d: "M12 5v14" }], ["path", { d: "m19 12-7 7-7-7" }]],
    dot: [["circle", { cx: 12, cy: 12, r: 4, fill: "currentColor", stroke: "none" }]],
    globe: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }], ["path", { d: "M2 12h20" }]],
    grip: [["circle", { cx: 9, cy: 6, r: 1 }], ["circle", { cx: 9, cy: 12, r: 1 }], ["circle", { cx: 9, cy: 18, r: 1 }], ["circle", { cx: 15, cy: 6, r: 1 }], ["circle", { cx: 15, cy: 12, r: 1 }], ["circle", { cx: 15, cy: 18, r: 1 }]],
  };

  function Icon(props) {
    const { name, size = 16, stroke = 2, className = "", style } = props;
    const node = IC[name] || [];
    return React.createElement(
      "svg",
      {
        width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round",
        strokeLinejoin: "round", className: ("lucide " + className).trim(),
        style, "aria-hidden": "true",
      },
      node.map(([tag, attrs], i) => React.createElement(tag, Object.assign({ key: i }, attrs)))
    );
  }

  window.IC = IC;
  window.Icon = Icon;
})();

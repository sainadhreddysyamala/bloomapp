import React from 'react';

/** Pure-CSS 3D flower: layered petals, orbiting rings and floating sparks.
 *  Tilts with the pointer when given data-tilt (handled by useFx). */
const layer = (count, cls) =>
  Array.from({ length: count }, (_, i) => (
    <i key={`${cls}-${i}`} className={`petal ${cls}`} style={{ '--i': i, '--n': count }} />
  ));

export function Bloom3D({ size = 'lg' }) {
  return (
    <div className={`bloom3d ${size}`} data-tilt="16" aria-hidden="true">
      <div className="bloom-stage">
        <span className="bloom-ring r1" />
        <span className="bloom-ring r2" />
        <span className="bloom-ring r3" />
        <div className="bloom-float">
          <div className="bloom-flower">
            {layer(10, 'outer')}
            {layer(10, 'mid')}
            {layer(8, 'inner')}
            <span className="bloom-core" />
          </div>
        </div>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span key={n} className={`spark s${n}`} />
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

// Standard 7-segment mapping: [a(top), b(top-right), c(bottom-right), d(bottom), e(bottom-left), f(top-left), g(middle)]
const SEGMENT_MAP: Record<string, [boolean, boolean, boolean, boolean, boolean, boolean, boolean]> = {
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
  '-': [false, false, false, false, false, false, true],
  ' ': [false, false, false, false, false, false, false],
};

const SevenSegmentDigit: React.FC<{ char: string }> = ({ char }) => {
  const segs = SEGMENT_MAP[char] ?? SEGMENT_MAP[' '];
  const offColor = '#1c0505';
  const onColor = '#ff1f1f';

  // Beveled 7-segment polygons in a 24x40 viewBox with slight forward LED slant
  const polygons = [
    '5,2 19,2 17,5.5 7,5.5',             // a: top
    '20,3 22,5.5 20.8,18.5 18.5,16.8 18.5,6', // b: top-right
    '18.5,22 20.6,20.5 19.4,34.5 17,37 16,33.5', // c: bottom-right
    '4,38 16,38 14.5,34.5 6,34.5',       // d: bottom
    '3.2,20.5 5.6,22 4.6,33.5 2,36.5 2.5,22', // e: bottom-left
    '4.8,3.2 6.8,6 5.8,16.8 3.4,18.5 4,5.5',  // f: top-left
    '5.5,19.5 7.5,17.7 17.5,17.7 19,19.5 17,21.3 7,21.3', // g: middle
  ];

  return (
    <svg
      viewBox="0 0 24 40"
      className="w-6 h-10 sm:w-8 sm:h-12 md:w-9 md:h-14 overflow-visible"
      style={{ transform: 'skewX(-7deg)' }}
      aria-hidden="true"
    >
      {polygons.map((points, idx) => {
        const active = segs[idx];
        return (
          <polygon
            key={idx}
            points={points}
            fill={active ? onColor : offColor}
            style={
              active
                ? { filter: 'drop-shadow(0 0 4px rgba(255, 30, 30, 0.85))' }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
};

interface SevenSegmentCounterProps {
  value: string;
  label?: string;
}

export const SevenSegmentCounter: React.FC<SevenSegmentCounterProps> = ({
  value,
  label,
}) => {
  const { lang } = useLanguage();
  const padded = value.slice(-5).padStart(5, '0').split('');

  return (
    <div
      className="relative inline-flex flex-col items-center select-none pointer-events-none"
      aria-label={
        label ? `${label}: ${value}` : lang === 'en' ? `Counter ${value}` : `Contador ${value}`
      }
    >
      {/* Top metallic mounting housing & clips matching hardware LED counter */}
      <div className="relative w-[78%] h-2.5 bg-gradient-to-b from-[#9ca3af] to-[#6b7280] rounded-t-sm border-x border-t border-[#4b5563] flex justify-between px-4 sm:px-6">
        <div className="w-3.5 h-2 bg-[#4b5563] border border-[#1f2937] rounded-b-[1px]" />
        <div className="w-3.5 h-2 bg-[#4b5563] border border-[#1f2937] rounded-b-[1px]" />
      </div>

      {/* Outer dark charcoal industrial bezel */}
      <div
        className="rounded-lg p-2 sm:p-2.5 bg-gradient-to-b from-[#454950] via-[#34373d] to-[#24262b] border border-[#525760]/70"
        style={{
          boxShadow:
            '0 12px 30px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -2px 0 rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Inner glossy pitch-black LED screen */}
        <div
          className="bg-[#020203] rounded-[4px] px-3.5 py-2 sm:px-5 sm:py-2.5 border border-black flex items-center gap-1.5 sm:gap-2.5"
          style={{
            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.95)',
          }}
        >
          {padded.map((ch, idx) => (
            <SevenSegmentDigit key={idx} char={ch} />
          ))}
        </div>
      </div>
    </div>
  );
};

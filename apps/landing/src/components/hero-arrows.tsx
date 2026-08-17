"use client";

// The hero's signature snake arrows: rounded quadratic curves with an
// arrowhead tip, drawn with currentColor so sections can tone them.

interface ArrowProps {
  className?: string;
}

export const SnakeArrowTopLeft = ({ className }: ArrowProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 100 120"
  >
    <path
      d="M20 10 Q30 35, 45 55 Q60 75, 80 95"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M68 88 L85 100 L78 82"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

export const SnakeArrowTopRight = ({ className }: ArrowProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 100 120"
  >
    <path
      d="M80 10 Q70 35, 55 55 Q40 75, 20 95"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M32 88 L15 100 L22 82"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

export const SnakeArrowLeftMiddle = ({ className }: ArrowProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 120 80"
  >
    <path
      d="M10 40 Q30 25, 50 45 Q70 65, 90 40 Q100 30, 110 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M100 32 L115 40 L100 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

export const SnakeArrowRightMiddle = ({ className }: ArrowProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 120 80"
  >
    <path
      d="M110 40 Q90 55, 70 35 Q50 15, 30 40 Q20 50, 10 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M20 32 L5 40 L20 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

export const SnakeArrowBottomLeft = ({ className }: ArrowProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 100 120"
  >
    <path
      d="M20 110 Q30 85, 45 65 Q60 45, 80 25"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M68 32 L85 20 L78 38"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

export const SnakeArrowBottomRight = ({ className }: ArrowProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 100 120"
  >
    <path
      d="M80 110 Q70 85, 55 65 Q40 45, 20 25"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M32 32 L15 20 L22 38"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

export const CurvedArrowUp = ({ className }: ArrowProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 60 100"
  >
    <path
      d="M30 95 Q25 70, 32 50 Q38 30, 30 10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="3"
    />
    <path
      d="M22 22 L30 5 L38 22"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
    />
  </svg>
);

export const CurvedArrowDown = ({ className }: ArrowProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 60 100"
  >
    <path
      d="M30 5 Q25 30, 32 50 Q38 70, 30 95"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="3"
    />
    <path
      d="M22 78 L30 95 L38 78"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
    />
  </svg>
);

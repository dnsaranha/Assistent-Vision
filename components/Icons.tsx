import React from 'react';

const iconProps = {
  className: "w-5 h-5 text-white",
  strokeWidth: 2,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
};

export const MicIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
  </svg>
);

export const ScreenIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M21 12V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7"></path>
    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
    <path d="M12 21a9 9 0 0 0 9-9h-2a7 7 0 0 1-7 7v2z"></path>
    <path d="M3 12a9 9 0 0 0 9 9v-2a7 7 0 0 1-7-7H3z"></path>
  </svg>
);

export const SendIcon: React.FC = () => (
  <svg {...iconProps}>
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

export const StopCircleIcon: React.FC = () => (
    <svg {...iconProps}>
        <circle cx="12" cy="12" r="10"></circle>
        <rect x="9" y="9" width="6" height="6"></rect>
    </svg>
);

export const SettingsIcon: React.FC = () => (
    <svg {...iconProps}>
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

export const DownloadIcon: React.FC = () => (
    <svg {...iconProps}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);
/// <reference types="vite/client" />

/// <reference types="vite-plugin-svgr/client" />

interface LabelingViewerApi {
  platform: string;
  getSpeakerImageDiagnostics?: () => SpeakerImageDiagnostic[];
  importProject?: () => Promise<ElectronImportFile[]>;
  onOpenProject?: (callback: () => void) => () => void;
}

interface Window {
  labelingViewer?: LabelingViewerApi;
}

interface ElectronImportFile {
  name: string;
  path: string;
  webkitRelativePath: string;
  dataUrl?: string;
  fileUrl: string;
  textContent?: string;
}

interface SpeakerImageDiagnostic {
  speaker: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  srcType: string;
  srcPreview: string;
}

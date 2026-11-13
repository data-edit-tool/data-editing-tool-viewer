import { type ChangeEvent, type InputHTMLAttributes, useCallback, useEffect, useRef, useState } from 'react';
import AlertProvider from 'providers/alert.provider';
import { useRecoilValue, useResetRecoilState, useSetRecoilState } from 'recoil';
import { currentSectionAtom } from 'state/current-section.atom';
import durationAtom from 'state/duration.atom';
import { isPlayAtom } from 'state/isPlay.atom';
import { repeatAgainAtom, repeatAtom } from 'state/repeat.atom';
import { scrollLeftAtom } from 'state/scrollLeft.atom';
import { scrollWidthAtom } from 'state/scrollWidth.atom';
import { seekingTimeAtom } from 'state/seeking-time.atom';
import { selectedSectionAtom } from 'state/selected-section.atom';
import { speedAtom } from 'state/speed.atom';
import { timeAtom } from 'state/time.atom';
import { viewerJobFileListAtom } from 'state/viewer-job-file-list';
import { viewerJobListAtom, viewerJobListSelector } from 'state/viewer-job-list';
import { viewerLabelingAtom } from 'state/viewer-labeling';
import { viewerLoadingSelector } from 'state/viewer-loading';
import { viewerLoadingAtom } from 'state/viewer-loading';
import { viewerModalAtom } from 'state/viewer-modal';
import { viewerProjectAtom } from 'state/viewer-project';
import { viewerLabelingCategoryAtom } from 'state/viwer-labeling-category-list';
import { zoomAtom } from 'state/zoom.atom';
import { styled } from 'styled-components';
import { IJobList } from 'types/worker-interface';
import { useElementSize } from 'usehooks-ts';
import { type ImportValidationResult, validateImportFolder } from 'utils/import-folder-validation';
import { createImportedViewerProject, type ImportedViewerProject } from 'utils/import-viewer-data';

import ViewerAudioSection from 'components/Common/Viewer/AudioSection';
import ViewerFolderSection from 'components/Common/Viewer/FolderSection';
import ViewerHeader from 'components/Common/Viewer/Header';
import ViewerSpeakerSection from 'components/Common/Viewer/SpeakerSection';
import ViewerVideoSection from 'components/Common/Viewer/VideoSection';
import Loading from 'components/Common/Worker/Loading';

import DndProvider from '../../providers/dnd.provider';

type ImportFolderTreeNode = {
  name: string;
  type: 'folder' | 'file' | 'more';
  required?: boolean;
  children?: ImportFolderTreeNode[];
};

const importFolderTree: ImportFolderTreeNode[] = [
  {
    name: 'SET240_M017 (mainset 예시)',
    type: 'folder',
    children: [
      { name: 'SET240_M017_{YYYYMMDDHHmmss}.json', type: 'file', required: true },
      {
        name: 'SET240_M017_S001 (subset 예시)',
        type: 'folder',
        children: [
          { name: 'SET240_M017_S001_001_F_20_SYSTEM_CS.mp4', type: 'file' },
          { name: 'SET240_M017_S001_001_F_20_SYSTEM_P.wav', type: 'file' },
          { name: 'SET240_M017_S001_001_F_20_SYSTEM_WS.mp4', type: 'file' },
          { name: 'SET240_M017_S001_002_F_30_HUMAN_CS.mp4', type: 'file' },
          { name: 'SET240_M017_S001_002_F_30_HUMAN_P.wav', type: 'file' },
          { name: 'SET240_M017_S001_002_F_30_HUMAN_WS.mp4', type: 'file' },
          { name: 'SET240_M017_S001_MIX_FFM_203020_ETC_FS.mp4', type: 'file' },
          { name: 'SET240_M017_S001_MIX_FFM_203020_ETC_P.wav', type: 'file' },
          { name: '...', type: 'more' },
        ],
      },
      {
        name: 'SET240_M017_S002 (subset 예시)',
        type: 'folder',
        children: [
          { name: 'SET240_M017_S002_001_F_20_SYSTEM_CS.mp4', type: 'file' },
          { name: 'SET240_M017_S002_001_F_20_SYSTEM_P.wav', type: 'file' },
          { name: 'SET240_M017_S002_MIX_FFM_203020_ETC_FS.mp4', type: 'file' },
          { name: 'SET240_M017_S002_MIX_FFM_203020_ETC_P.wav', type: 'file' },
        ],
      },
      { name: '...', type: 'more' },
      {
        name: 'speakerThumbnail (선택)',
        type: 'folder',
        children: [
          { name: 'SPEAKER_001_F_30_ETC_SYSTEM.jpg', type: 'file' },
          { name: 'SPEAKER_002_F_30_ETC_HUMAN.jpg', type: 'file' },
        ],
      },
    ],
  },
];

const importRules = [
  {
    title: '폴더명 규칙',
    items: ['Mainset: SET###_M###', 'Subset: {Mainset}_S###'],
  },
  {
    title: 'JSON 파일',
    items: ['형식: {Mainset}_{생성시간}.json', '생성시간 형식: YYYYMMDDHHmmss'],
  },
  {
    title: '영상 파일',
    items: ['형식: {Subset}_{화자번호}_{성별}_{나이}_{역할}_{CS|WS}.mp4'],
  },
  {
    title: '음성 파일',
    items: ['형식: {Subset}_{화자번호}_{성별}_{나이}_{역할}_P.wav'],
  },
  {
    title: 'MIX 파일',
    items: ['형식: {Subset}_MIX_{성별조합}_{나이조합}_{관계}_{FS|P}.{mp4|wav}'],
  },
  {
    title: '발화자 이미지',
    items: ['형식: {화자번호가 포함된 파일명}.{jpg|jpeg|png|webp|gif}'],
  },
  {
    title: '필수 파일',
    items: ['Mainset JSON 1개', 'Subset별 mp4 파일 5개 이상, wav 파일 4개 이상'],
  },
];

const directoryInputProps = {
  directory: '',
  webkitdirectory: '',
} as InputHTMLAttributes<HTMLInputElement> & {
  directory: string;
  webkitdirectory: string;
};

const createElectronImportFile = (file: ElectronImportFile) => {
  const importFile = {
    ...file,
    text: async () => file.textContent ?? '',
  };
  return importFile as unknown as File;
};

const VIEWER_MIN_WIDTH = '1360px';
const VIEWER_MIN_HEIGHT = '960px';

const ImportFolderTree = ({ nodes }: { nodes: ImportFolderTreeNode[] }) => {
  return (
    <ul className="folder-tree-list">
      {nodes.map((node) => (
        <li className="tree-node" data-required={node.required ? 'true' : undefined} data-type={node.type} key={node.name}>
          <span className="node-label">
            <span className="node-name">{node.name}</span>
            {node.required && <span className="required-badge">필수</span>}
          </span>
          {!!node.children?.length && <ImportFolderTree nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
};

const WorkerJobWrapper = styled.div<{ status: string }>`
  flex: 1 1 0;
  min-width: 0;
  padding-right: clamp(8px, 0.8vw, 15px);
  ${({ status }) => status === 'ready' && `pointer-events: none;`}
`;

const WorkerScrollArea = styled.div`
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: auto;
  background-color: ${({ theme }) => theme.workerColor.black};

  &::-webkit-scrollbar {
    width: 12px;
    height: 12px;
    background-color: #373d48;
  }

  &::-webkit-scrollbar-track {
    background-color: #373d48;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 16px;
    background-color: ${({ theme }) => theme.workerColor.line2};
  }

  &::-webkit-scrollbar-button {
    display: none;
  }
`;

const WorkerWrapper = styled.div<{ $centerContent: boolean }>`
  position: relative;
  display: flex;
  justify-content: center;
  min-width: ${VIEWER_MIN_WIDTH};
  min-height: ${({ $centerContent }) => ($centerContent ? '100vh' : VIEWER_MIN_HEIGHT)};
  min-height: ${({ $centerContent }) => ($centerContent ? '100dvh' : VIEWER_MIN_HEIGHT)};
  background-color: ${({ theme }) => theme.workerColor.black};
  ${({ $centerContent }) =>
    $centerContent &&
    `
      align-items: center;
      @supports (align-items: safe center) {
        align-items: safe center;
      }
    `}
  .worker-background {
    background-color: ${({ theme }) => theme.workerColor.black};
    margin: 0 auto;
    display: flex;
    justify-content: center;
    color: #fff;
    width: 100%;
    ${({ $centerContent }) =>
      !$centerContent &&
      `
        min-height: 100vh;
        min-height: 100dvh;
      `}
    min-width: 1360px;
    max-width: 1920px;
    min-height: inherit;
    .worker-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      min-height: inherit;
      .worker-bottom {
        display: flex;
        flex-direction: row;
        width: 100%;
        min-width: 0;
        margin-top: 20px;
        .worker-audio {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
      }
    }
  }
`;

const InitialImportOverlay = styled.div`
  position: fixed;
  z-index: 8000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(2px);
  padding: 32px;

  .import-content {
    display: flex;
    flex-direction: column;
    width: min(820px, calc(100vw - 48px));
    max-height: calc(100dvh - 64px);
    overflow-y: auto;
    border: 1px solid rgba(170, 174, 178, 0.26);
    border-radius: 8px;
    background-color: rgba(18, 22, 31, 0.94);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.48);
    padding: 20px;
  }

  .import-button {
    width: 140px;
    height: 42px;
    flex: 0 0 auto;
    border-radius: 6px;
    background-color: ${({ theme }) => theme.workerColor.primary};
    color: ${({ theme }) => theme.workerColor.white};
    font-size: ${({ theme }) => theme.fontSize.text_16};
    font-weight: 700;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);

    &:hover {
      background-color: #2a358b;
    }
  }

  .folder-guide {
    width: 100%;
    min-height: 0;
  }

  .guide-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .guide-title {
    color: ${({ theme }) => theme.workerColor.white};
    font-size: ${({ theme }) => theme.fontSize.text_16};
    font-weight: 700;
  }

  .guide-description {
    margin-top: 8px;
    color: ${({ theme }) => theme.workerColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_14};
    line-height: 1.5;
  }

  .data-json-note {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid rgba(143, 164, 255, 0.28);
    border-radius: 6px;
    background-color: rgba(51, 64, 168, 0.16);
    color: ${({ theme }) => theme.workerColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_14};
    line-height: 1.4;
  }

  .json-chip {
    flex: 0 0 auto;
    border-radius: 4px;
    background-color: rgba(143, 164, 255, 0.2);
    color: #c7d1ff;
    padding: 4px 8px;
    font-weight: 700;
  }

  .guide-section-title {
    margin-top: 16px;
    color: ${({ theme }) => theme.workerColor.white};
    font-size: ${({ theme }) => theme.fontSize.text_14};
    font-weight: 700;
  }

  .rule-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }

  .rule-list li {
    position: relative;
    min-height: 44px;
    padding: 8px 10px;
    border-radius: 6px;
    background-color: rgba(255, 255, 255, 0.045);
    color: ${({ theme }) => theme.workerColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_12};
    line-height: 1.35;
  }

  .rule-title {
    display: block;
    margin-bottom: 4px;
    color: #dfe5ff;
    font-weight: 700;
  }

  .rule-text {
    display: block;
    overflow-wrap: anywhere;
  }

  .rule-items {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .validation-result {
    margin-top: 14px;
    border-radius: 6px;
    padding: 12px;
    border: 1px solid rgba(170, 174, 178, 0.2);
    background-color: rgba(255, 255, 255, 0.045);

    &.success {
      border-color: rgba(51, 168, 123, 0.45);
      background-color: rgba(51, 168, 123, 0.12);
    }

    &.error {
      border-color: rgba(253, 13, 87, 0.42);
      background-color: rgba(253, 13, 87, 0.1);
    }
  }

  .validation-title {
    color: ${({ theme }) => theme.workerColor.white};
    font-size: ${({ theme }) => theme.fontSize.text_14};
    font-weight: 700;
  }

  .validation-summary {
    margin-top: 6px;
    color: ${({ theme }) => theme.workerColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_12};
    line-height: 1.45;
  }

  .validation-issues {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 120px;
    overflow-y: auto;
  }

  .validation-issues li {
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 8px 10px;
    color: ${({ theme }) => theme.workerColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_12};
    line-height: 1.45;
  }

  .issue-location,
  .issue-file {
    color: ${({ theme }) => theme.workerColor.white};
    font-weight: 700;
  }

  .folder-tree {
    margin-top: 10px;
    max-height: min(26dvh, 260px);
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid rgba(170, 174, 178, 0.18);
    border-radius: 8px;
    background-color: #080b10;
    padding: 16px 18px;
  }

  .folder-tree-list {
    position: relative;
    list-style: none;
    margin: 0;
    padding-left: 20px;
  }

  .folder-tree > .folder-tree-list {
    padding-left: 0;
  }

  .tree-node {
    position: relative;
    margin-top: 8px;
    padding-left: 22px;
    color: ${({ theme }) => theme.workerColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_14};
    line-height: 1.35;
    overflow-wrap: anywhere;

    &:first-child {
      margin-top: 0;
    }

    &::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 3px;
      width: 12px;
      border-top: 1px solid rgba(170, 174, 178, 0.32);
    }

    &::after {
      content: '';
      position: absolute;
      top: -8px;
      bottom: 10px;
      left: 3px;
      border-left: 1px solid rgba(170, 174, 178, 0.32);
    }
  }

  .folder-tree > .folder-tree-list > .tree-node {
    padding-left: 20px;

    &::after {
      top: 10px;
    }
  }

  .node-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    &::before {
      content: '';
      width: 10px;
      height: 10px;
      flex: 0 0 10px;
      border-radius: 2px;
      background-color: #6f7788;
    }
  }

  .required-badge {
    flex: 0 0 auto;
    border-radius: 999px;
    background-color: rgba(253, 13, 87, 0.18);
    color: #ff86ae;
    padding: 2px 7px;
    font-size: ${({ theme }) => theme.fontSize.text_12};
    font-weight: 700;
  }

  .tree-node[data-type='folder'] > .node-label {
    color: ${({ theme }) => theme.workerColor.white};
    font-weight: 600;

    &::before {
      height: 8px;
      border-radius: 2px 2px 3px 3px;
      background-color: #d7a83f;
      box-shadow: 0 -3px 0 #f2c55a inset;
    }
  }

  .tree-node[data-type='file'] > .node-label::before {
    border-radius: 2px;
    background-color: #8fa4ff;
  }

  .tree-node[data-required='true'] > .node-label {
    color: #dfe5ff;
    font-weight: 700;
  }

  .tree-node[data-type='more'] {
    color: #707789;
  }
`;

const ViewerWorker = () => {
  const loading = useRecoilValue(viewerLoadingSelector);
  const viewerJobList = useRecoilValue(viewerJobListSelector);
  const [ref] = useElementSize();
  const isInitialImportReady = viewerJobList.length === 0;
  const importInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [importValidation, setImportValidation] = useState<ImportValidationResult | null>(null);
  const [importedViewerProject, setImportedViewerProject] = useState<ImportedViewerProject | null>(null);

  const setViewerProject = useSetRecoilState(viewerProjectAtom);
  const setViewerJobList = useSetRecoilState(viewerJobListAtom);
  const setViewerJobFileList = useSetRecoilState(viewerJobFileListAtom);
  const setViewerLabeling = useSetRecoilState(viewerLabelingAtom);
  const setViewerLabelingCategory = useSetRecoilState(viewerLabelingCategoryAtom);
  const setViewerLoading = useSetRecoilState(viewerLoadingAtom);

  const resetViewerProject = useResetRecoilState(viewerProjectAtom);
  const resetViewerJobList = useResetRecoilState(viewerJobListAtom);
  const resetViewerJobFileList = useResetRecoilState(viewerJobFileListAtom);
  const resetViewerLabeling = useResetRecoilState(viewerLabelingAtom);
  const resetViewerLabelingCategory = useResetRecoilState(viewerLabelingCategoryAtom);
  const resetViewerLoading = useResetRecoilState(viewerLoadingAtom);
  const resetViewerModal = useResetRecoilState(viewerModalAtom);

  const resetZoom = useResetRecoilState(zoomAtom);
  const resetTime = useResetRecoilState(timeAtom);
  const resetIsPlaying = useResetRecoilState(isPlayAtom);
  const resetSpeed = useResetRecoilState(speedAtom);
  const resetDuration = useResetRecoilState(durationAtom);
  const resetScrollWidth = useResetRecoilState(scrollWidthAtom);
  const resetScrollLeft = useResetRecoilState(scrollLeftAtom);
  const resetSelectedSection = useResetRecoilState(selectedSectionAtom);
  const resetRepeat = useResetRecoilState(repeatAtom);
  const resetRepeatAgain = useResetRecoilState(repeatAgainAtom);
  const resetSeekingTime = useResetRecoilState(seekingTimeAtom);
  const resetCurrentSection = useResetRecoilState(currentSectionAtom);

  const resetPlaybackState = useCallback(() => {
    resetZoom();
    resetTime();
    resetIsPlaying();
    resetSpeed();
    resetDuration();
    resetScrollWidth();
    resetScrollLeft();
    resetSelectedSection();
    resetRepeat();
    resetRepeatAgain();
    resetSeekingTime();
    resetCurrentSection();
  }, [
    resetCurrentSection,
    resetDuration,
    resetIsPlaying,
    resetRepeat,
    resetRepeatAgain,
    resetScrollLeft,
    resetScrollWidth,
    resetSeekingTime,
    resetSelectedSection,
    resetSpeed,
    resetTime,
    resetZoom,
  ]);

  const revokeObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    objectUrlsRef.current = [];
  }, []);

  const applyImportedViewerSubset = useCallback(
    (project: ImportedViewerProject, job: IJobList) => {
      const subset = project.subsetsByJobId[job.job_id];
      if (!subset) {
        return;
      }
      resetPlaybackState();
      setViewerProject({ projectName: project.projectName });
      setViewerJobList({ list: project.jobs, selectJobId: subset.job });
      setViewerJobFileList(subset.fileState);
      setViewerLabeling(subset.labelingState);
      setViewerLabelingCategory(project.categoryState);
      setViewerLoading({ waveformReady: true, labelingReady: true });
    },
    [resetPlaybackState, setViewerJobFileList, setViewerJobList, setViewerLabeling, setViewerLabelingCategory, setViewerLoading, setViewerProject],
  );

  const clearViewerState = useCallback(() => {
    revokeObjectUrls();
    resetViewerProject();
    resetViewerJobList();
    resetViewerJobFileList();
    resetViewerLabeling();
    resetViewerLabelingCategory();
    resetViewerLoading();
    resetViewerModal();
    resetPlaybackState();
  }, [
    resetPlaybackState,
    resetViewerJobFileList,
    resetViewerJobList,
    resetViewerLabeling,
    resetViewerLabelingCategory,
    resetViewerLoading,
    resetViewerModal,
    resetViewerProject,
    revokeObjectUrls,
  ]);

  const resetImportedViewer = useCallback(() => {
    clearViewerState();
    setImportedViewerProject(null);
    setImportValidation(null);
  }, [clearViewerState]);

  useEffect(() => {
    return () => {
      clearViewerState();
    };
  }, [clearViewerState]);

  const processImportFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) {
        return;
      }

      const validationResult = validateImportFolder(files);

      if (!validationResult.valid) {
        clearViewerState();
        setImportedViewerProject(null);
        setImportValidation(validationResult);
        return;
      }

      setImportValidation(null);
      clearViewerState();
      setImportedViewerProject(null);

      try {
        const project = await createImportedViewerProject(files);
        const firstJob = project.jobs[0];
        revokeObjectUrls();
        objectUrlsRef.current = project.objectUrls;
        setImportedViewerProject(project);
        applyImportedViewerSubset(project, firstJob);
      } catch (error) {
        setImportValidation({
          ...validationResult,
          valid: false,
          issues: [
            {
              location: validationResult.rootName || 'SET###_M###',
              message: error instanceof Error ? error.message : 'Mainset JSON을 viewer state로 변환하지 못했습니다.',
            },
          ],
        });
      }
    },
    [applyImportedViewerSubset, clearViewerState, revokeObjectUrls],
  );

  const handleImportClick = useCallback(async () => {
    const nativeFiles = window.location.protocol === 'file:' ? await window.labelingViewer?.importProject?.() : undefined;
    if (nativeFiles) {
      await processImportFiles(nativeFiles.map(createElectronImportFile));
      return;
    }
    importInputRef.current?.click();
  }, [processImportFiles]);

  useEffect(() => {
    const unsubscribe = window.labelingViewer?.onOpenProject?.(handleImportClick);
    return () => {
      unsubscribe?.();
    };
  }, [handleImportClick]);

  const handleImportFolderChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await processImportFiles(files);
  };

  const handleImportedJobSelect = (job: IJobList) => {
    if (!importedViewerProject) {
      return;
    }
    applyImportedViewerSubset(importedViewerProject, job);
  };

  return (
    <AlertProvider>
      <DndProvider>
        <WorkerScrollArea>
          <WorkerWrapper $centerContent={isInitialImportReady}>
            <div className="worker-background">
              <div className="worker-container">
                <ViewerHeader onExit={isInitialImportReady ? undefined : resetImportedViewer} />
                <div className="worker-bottom">
                  <ViewerFolderSection onSelectJob={handleImportedJobSelect} />
                  <WorkerJobWrapper status={''}>
                    <ViewerVideoSection />
                    <div ref={ref} className="worker-audio">
                      <ViewerAudioSection />
                      <ViewerSpeakerSection />
                    </div>
                  </WorkerJobWrapper>
                </div>
              </div>
            </div>
            {isInitialImportReady && (
              <InitialImportOverlay>
                <div className="import-content">
                  <section className="folder-guide" aria-label="Import folder structure guide">
                    <div className="guide-header">
                      <div className="guide-title">폴더 구조 가이드</div>
                      <button className="import-button" type="button" aria-label="Import" onClick={handleImportClick}>
                        Import
                      </button>
                    </div>
                    <div className="guide-description">폴더명, Mainset JSON, 미디어 파일명은 Mainset 이름을 기준으로 같은 prefix 규칙을 맞춰야 합니다.</div>
                    <div className="data-json-note">
                      <span className="json-chip">예시</span>
                      <span>SET240_M017 / SET240_M017_20260526113255.json / SET240_M017_S001 / SET240_M017_S001_001_F_20_SYSTEM_CS.mp4</span>
                    </div>
                    <div className="guide-section-title">SET 규칙</div>
                    <ul className="rule-list">
                      {importRules.map((rule) => (
                        <li key={rule.title}>
                          <span className="rule-title">{rule.title}</span>
                          <span className="rule-items">
                            {rule.items.map((item) => (
                              <span className="rule-text" key={item}>
                                {item}
                              </span>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {importValidation && (
                      <div className={`validation-result ${importValidation.valid ? 'success' : 'error'}`}>
                        <div className="validation-title">{importValidation.valid ? '규칙 확인 완료' : '규칙 오류'}</div>
                        <div className="validation-summary">
                          {importValidation.valid
                            ? `${importValidation.rootName} 폴더에서 ${importValidation.subsetCount}개 Subset, ${importValidation.fileCount}개 파일을 확인했습니다.`
                            : `${importValidation.issues.length}개의 문제가 있습니다. 아래 위치와 파일을 확인해주세요.`}
                        </div>
                        {!importValidation.valid && (
                          <ul className="validation-issues">
                            {importValidation.issues.map((issue, index) => (
                              <li key={`${issue.location}-${issue.fileName || 'folder'}-${index}`}>
                                <span className="issue-location">{issue.location}</span>
                                {issue.fileName && (
                                  <>
                                    {' '}
                                    / <span className="issue-file">{issue.fileName}</span>
                                  </>
                                )}
                                : {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <div className="guide-section-title">예시</div>
                    <div className="folder-tree">
                      <ImportFolderTree nodes={importFolderTree} />
                    </div>
                  </section>
                </div>
              </InitialImportOverlay>
            )}
            <input {...directoryInputProps} ref={importInputRef} className="visually-hidden" type="file" multiple onChange={handleImportFolderChange} />
            {loading && <Loading />}
          </WorkerWrapper>
        </WorkerScrollArea>
      </DndProvider>
    </AlertProvider>
  );
};

export default ViewerWorker;

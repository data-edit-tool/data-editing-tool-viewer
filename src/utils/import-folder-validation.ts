import { getRootJsonFileNamePattern, isRootJsonFileName } from './import-root-json';

export interface ImportFileLike {
  name: string;
  type?: string;
  webkitRelativePath?: string;
  path?: string;
}

export interface ImportValidationIssue {
  location: string;
  fileName?: string;
  message: string;
}

export interface ImportValidationResult {
  valid: boolean;
  rootName: string;
  subsetCount: number;
  fileCount: number;
  issues: ImportValidationIssue[];
}

const MAINSET_NAME_PATTERN = 'SET###_M###';
const MAINSET_NAME_REGEX = /^SET\d{3}_M\d{3}$/;
const SPEAKER_THUMBNAIL_FOLDER_NAME = 'speakerThumbnail';
const SPEAKER_THUMBNAIL_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createSubsetNameRegex = (rootName: string) => new RegExp(`^${escapeRegExp(rootName)}_S\\d{3}$`);

const createMediaFileRegex = (subsetName: string) =>
  new RegExp(`^${escapeRegExp(subsetName)}_(\\d{3}|MIX)_[MF]+_(?:(?:[1-9]0|[1-9][0-9]0))+_[A-Za-z_\\s]+_(FS|WS|CS|P|B)+\\.(mp4|wav)$`, 'i');

const createStt8kWavRegex = (subsetName: string) => new RegExp(`^${escapeRegExp(subsetName)}_STT8K_\\d{3}\\.wav$`, 'i');

const getFilePath = (file: ImportFileLike) => file.webkitRelativePath || file.path || file.name;

const getPathParts = (file: ImportFileLike) => getFilePath(file).split('/').filter(Boolean);

const isHiddenOrSystemFile = (file: ImportFileLike) => {
  const pathParts = getPathParts(file);
  return file.name === 'Thumbs.db' || pathParts.some((part) => part.startsWith('.'));
};

const getExtension = (fileName: string) => {
  const match = fileName.match(/\.([^.]+)$/);
  return match?.[1]?.toLowerCase() || '';
};

const isSpeakerThumbnailExtension = (fileName: string) => SPEAKER_THUMBNAIL_EXTENSIONS.has(getExtension(fileName));

const pushIssue = (issues: ImportValidationIssue[], issue: ImportValidationIssue) => {
  issues.push(issue);
};

export const validateImportFolder = (files: ImportFileLike[]): ImportValidationResult => {
  const issues: ImportValidationIssue[] = [];
  const availableFiles = files.filter((file) => !isHiddenOrSystemFile(file));
  const pathPartsList = availableFiles.map((file) => ({ file, pathParts: getPathParts(file) })).filter(({ pathParts }) => pathParts.length > 0);
  const rootNames = Array.from(new Set(pathPartsList.map(({ pathParts }) => pathParts[0])));
  const rootName = rootNames[0] || '';

  if (!availableFiles.length) {
    pushIssue(issues, {
      location: MAINSET_NAME_PATTERN,
      message: '선택한 폴더 안에 검사할 파일이 없습니다.',
    });
  }

  if (rootNames.length > 1) {
    pushIssue(issues, {
      location: '선택한 폴더',
      message: `최상위 폴더는 하나만 선택해야 합니다. 감지된 폴더: ${rootNames.join(', ')}`,
    });
  }

  if (rootName && !MAINSET_NAME_REGEX.test(rootName)) {
    pushIssue(issues, {
      location: rootName,
      message: `최상위 폴더명은 ${MAINSET_NAME_PATTERN} 형식이어야 합니다. 예: SET240_M017`,
    });
  }

  const activeRootName = rootName || MAINSET_NAME_PATTERN;
  const expectedRootJsonFileName = getRootJsonFileNamePattern(activeRootName);
  const rootJsonFiles = pathPartsList.filter(
    ({ pathParts }) => pathParts.length === 2 && pathParts[0] === rootName && isRootJsonFileName(pathParts[1], rootName),
  );
  if (!rootJsonFiles.length) {
    pushIssue(issues, {
      location: activeRootName,
      fileName: expectedRootJsonFileName,
      message: `${expectedRootJsonFileName} 형식의 JSON 파일이 ${activeRootName} 바로 아래에 있어야 합니다. {YYYYMMDDHHmmss}는 생성 시간값입니다.`,
    });
  }
  if (rootJsonFiles.length > 1) {
    pushIssue(issues, {
      location: activeRootName,
      message: `Mainset JSON 파일은 하나만 둘 수 있습니다. 감지된 파일: ${rootJsonFiles.map(({ file }) => file.name).join(', ')}`,
    });
  }

  const subsetMap = new Map<string, { mp4Count: number; wavCount: number; hasFile: boolean }>();
  const reportedSubsetNames = new Set<string>();
  const reportedNestedFolders = new Set<string>();

  pathPartsList.forEach(({ file, pathParts }) => {
    const [root, subFolderName, fileName] = pathParts;

    if (root !== rootName) {
      return;
    }

    if (pathParts.length === 2 && fileName === undefined) {
      if (isRootJsonFileName(subFolderName, rootName)) {
        return;
      }
      if (getExtension(subFolderName) === 'json') {
        pushIssue(issues, {
          location: activeRootName,
          fileName: subFolderName,
          message: `최상위 JSON 파일명은 ${expectedRootJsonFileName} 형식이어야 합니다.`,
        });
      } else {
        pushIssue(issues, {
          location: activeRootName,
          fileName: subFolderName,
          message: `최상위에는 ${expectedRootJsonFileName} JSON 파일만 둘 수 있습니다. 미디어 파일은 Subset 폴더 안에 넣어주세요.`,
        });
      }
      return;
    }

    if (!subFolderName || !fileName) {
      pushIssue(issues, {
        location: activeRootName,
        fileName: file.name,
        message: '파일은 Subset 폴더 안에 있어야 합니다.',
      });
      return;
    }

    if (subFolderName === SPEAKER_THUMBNAIL_FOLDER_NAME) {
      if (pathParts.length !== 3) {
        const nestedLocation = `${root}/${subFolderName}`;
        if (!reportedNestedFolders.has(nestedLocation)) {
          reportedNestedFolders.add(nestedLocation);
          pushIssue(issues, {
            location: nestedLocation,
            fileName: file.name,
            message: 'speakerThumbnail 폴더 안에 추가 하위 폴더를 만들 수 없습니다.',
          });
        }
        return;
      }
      if (!isSpeakerThumbnailExtension(file.name)) {
        pushIssue(issues, {
          location: `${root}/${subFolderName}`,
          fileName: file.name,
          message: 'speakerThumbnail 폴더에는 jpg, jpeg, png, webp, gif 이미지만 넣을 수 있습니다.',
        });
      }
      return;
    }

    if (!createSubsetNameRegex(rootName).test(subFolderName)) {
      if (!reportedSubsetNames.has(subFolderName)) {
        reportedSubsetNames.add(subFolderName);
        pushIssue(issues, {
          location: `${root}/${subFolderName}`,
          message: `Subset 폴더명은 ${activeRootName}_S001처럼 Mainset명 + _S + 3자리 숫자 형식이어야 합니다.`,
        });
      }
      return;
    }

    if (pathParts.length !== 3) {
      const nestedLocation = `${root}/${subFolderName}`;
      if (!reportedNestedFolders.has(nestedLocation)) {
        reportedNestedFolders.add(nestedLocation);
        pushIssue(issues, {
          location: nestedLocation,
          fileName: file.name,
          message: 'Subset 폴더 안에 추가 하위 폴더를 만들 수 없습니다.',
        });
      }
      return;
    }

    const subsetInfo = subsetMap.get(subFolderName) || { mp4Count: 0, wavCount: 0, hasFile: false };
    subsetInfo.hasFile = true;
    subsetMap.set(subFolderName, subsetInfo);

    if (!fileName.startsWith(`${subFolderName}_`)) {
      pushIssue(issues, {
        location: `${root}/${subFolderName}`,
        fileName,
        message: '파일명은 Subset 폴더명으로 시작해야 합니다.',
      });
      return;
    }

    const extension = getExtension(fileName);
    if (extension !== 'mp4' && extension !== 'wav') {
      pushIssue(issues, {
        location: `${root}/${subFolderName}`,
        fileName,
        message: 'Subset 폴더에는 mp4 또는 wav 파일만 넣을 수 있습니다.',
      });
      return;
    }

    if (extension === 'mp4') {
      if (!createMediaFileRegex(subFolderName).test(fileName)) {
        pushIssue(issues, {
          location: `${root}/${subFolderName}`,
          fileName,
          message: '영상 파일명은 {Subset}_{화자번호|MIX}_{성별}_{나이}_{역할/관계}_{CS|WS|FS}.mp4 형식이어야 합니다.',
        });
        return;
      }
      subsetInfo.mp4Count += 1;
      return;
    }

    if (!createMediaFileRegex(subFolderName).test(fileName) && !createStt8kWavRegex(subFolderName).test(fileName)) {
      pushIssue(issues, {
        location: `${root}/${subFolderName}`,
        fileName,
        message: '오디오 파일명은 {Subset}_{화자번호|MIX}_{성별}_{나이}_{역할/관계}_P.wav 형식이어야 합니다.',
      });
      return;
    }
    subsetInfo.wavCount += 1;
  });

  if (!subsetMap.size) {
    pushIssue(issues, {
      location: activeRootName,
      message: 'Subset 폴더가 없습니다.',
    });
  }

  Array.from(subsetMap.entries()).forEach(([subsetName, subsetInfo]) => {
    if (!subsetInfo.hasFile) {
      pushIssue(issues, {
        location: `${activeRootName}/${subsetName}`,
        message: 'Subset 폴더에 파일이 없습니다.',
      });
    }
    if (subsetInfo.mp4Count < 5) {
      pushIssue(issues, {
        location: `${activeRootName}/${subsetName}`,
        message: `영상 파일은 5개 이상 필요합니다. 현재 ${subsetInfo.mp4Count}개입니다.`,
      });
    }
    if (subsetInfo.wavCount < 4) {
      pushIssue(issues, {
        location: `${activeRootName}/${subsetName}`,
        message: `오디오 파일은 4개 이상 필요합니다. 현재 ${subsetInfo.wavCount}개입니다.`,
      });
    }
  });

  return {
    valid: issues.length === 0,
    rootName,
    subsetCount: subsetMap.size,
    fileCount: availableFiles.length,
    issues,
  };
};

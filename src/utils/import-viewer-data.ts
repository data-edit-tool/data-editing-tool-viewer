import { IJobCategoryListDepth, IJobFileList, IJobList, ILabelingAll, ILabelingGaze, IVoiceMeasurements } from 'types/worker-interface';

import { getRootJsonFileNamePattern, isRootJsonFileName } from './import-root-json';

const MAINSET_NAME_PATTERN = 'SET###_M###';
const MAINSET_NAME_REGEX = /^SET\d{3}_M\d{3}$/;
const SPEAKER_THUMBNAIL_FOLDER_NAME = 'speakerThumbnail';
const SPEAKER_THUMBNAIL_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const SPEAKER_THUMBNAIL_COLORS = ['#4b63d1', '#33a87b', '#c57b35', '#8f5bd1', '#c3476d'];

type ImportedFile = File & {
  webkitRelativePath: string;
  dataUrl?: string;
  fileUrl?: string;
};

interface ImportedDataJson {
  mainset_info?: {
    mainset_id?: string;
    speaker_info?: {
      speaker_ids?: string[];
      speaker_profiles?: {
        speaker_id?: string;
      }[];
    };
  };
  subset_info?: {
    sets?: ImportedSubsetData[];
  };
}

interface ImportedSubsetData {
  subset_id?: string;
  video_name_set?: string[];
  audio_name_set?: string[];
  gaze?: ImportedGaze[];
  dialogue?: {
    section?: ImportedSection[];
    information?: ImportedDialogueInformation;
  };
}

interface ImportedSection {
  section_id?: string;
  speaker_id?: string;
  start_time?: string | number;
  end_time?: string | number;
}

interface ImportedDialogueInformation {
  verbal?: ImportedVerbal[];
  overall?: ImportedOverall[];
  'para-verbal'?: ImportedParaverbal[];
  'non-verbal'?: ImportedNonVerbal[];
  gaze?: ImportedGaze[];
}

interface ImportedVerbal {
  section_id?: string;
  channel?: string;
  sentence?: string;
  sentiment?: string;
  emotion?: string;
  fc_intent?: string;
  bc_intent?: string;
  intent?: string;
}

interface ImportedOverall {
  section_id?: string;
  affective_state?: string;
  vad?: {
    vp?: ImportedVad;
    vpn?: ImportedVad;
  };
}

interface ImportedVad {
  valence?: number;
  arousal?: number;
  dominance?: number;
}

interface ImportedParaverbal {
  section_id?: string;
  loudness?: string[];
  pitch?: string[];
  'para-verbal_ft'?: {
    section_id?: string;
    function?: string;
  }[];
}

interface ImportedNonVerbal {
  section_id?: string;
  camera_angle?: string;
  body?: {
    gesture?: {
      subject?: string;
      action?: {
        main?: string;
        description?: string;
      };
      object?: string;
    };
    function?: string;
    emotion?: string;
  };
  'non-verbal_only'?: {
    intent?: string;
    affective_state?: string;
  };
}

interface ImportedGaze {
  speaker_id?: string;
  target_id?: string;
  start_time?: string | number;
  end_time?: string | number;
}

interface ImportedSubsetViewerState {
  job: IJobList;
  fileState: {
    videoList: IJobFileList[];
    audioList: IJobFileList[];
    selectVideoId: IJobFileList | null;
    selectAudioId: IJobFileList | null;
  };
  labelingState: {
    list: {
      verbalList: ILabelingAll[];
      paraverbalList: ILabelingAll[];
      nonVerbalList: ILabelingAll[];
      gazeList: ILabelingGaze[];
      speakers: {
        speaker_id: string;
        thumbnail_file_url: string;
      };
      voice_measurements: IVoiceMeasurements[];
    }[];
    verbalList: ILabelingAll[];
  };
}

interface ImportedViewerProject {
  projectName: string;
  jobs: IJobList[];
  subsetsByJobId: Record<string, ImportedSubsetViewerState>;
  categoryState: {
    affectiveList: CategoryRoot;
    channelList: CategoryRoot;
    sentimentList: CategoryRoot;
    fcIntentList: CategoryRoot;
    bcIntentList: CategoryRoot;
    emotionList: CategoryRoot;
    verbalVADList: CategoryRoot;
    overallVADList: CategoryRoot;
    paraverbalList: IJobCategoryListDepth[];
    angleList: CategoryRoot;
    gSubjectList: CategoryRoot;
    gActionList: CategoryRoot;
    gObjectList: CategoryRoot;
    intentList: CategoryRoot;
    funcList: CategoryRoot;
    nonVerbalEmotionList: CategoryRoot;
    nonVerbalAffectiveList: CategoryRoot;
  };
  objectUrls: string[];
}

type CategoryRoot = {
  ctg_name: string;
  ctg_id: string;
  ctg_depth: IJobCategoryListDepth[];
};

type CategoryAccumulatorKey =
  | 'affectiveList'
  | 'channelList'
  | 'sentimentList'
  | 'fcIntentList'
  | 'bcIntentList'
  | 'emotionList'
  | 'verbalVADList'
  | 'overallVADList'
  | 'angleList'
  | 'gSubjectList'
  | 'gActionList'
  | 'gObjectList'
  | 'intentList'
  | 'funcList'
  | 'nonVerbalEmotionList'
  | 'nonVerbalAffectiveList';

type CategoryAccumulator = Record<CategoryAccumulatorKey, Set<string>> & {
  paraverbalList: Set<string>;
};

const createEmptyLabeling = (params: {
  section: ImportedSection;
  labelingId: string;
  verbalId?: string;
  paraverbalId?: string;
  nonverbalId?: string;
}): ILabelingAll => ({
  start_time: parseTimeToMillis(params.section.start_time),
  end_time: parseTimeToMillis(params.section.end_time),
  speaker_id: params.section.speaker_id || '',
  labeling_id: params.labelingId,
  verbal_id: params.verbalId || '',
  sentence: '',
  channel: '',
  sentiment: '',
  fc_intent: '',
  bc_intent: '',
  emotion: '',
  affective_state: '',
  verbal_vad: createVad(),
  overall_vad: createVad(),
  paraverbal_id: params.paraverbalId || '',
  func: '',
  nonverbal_id: params.nonverbalId || '',
  angle: '',
  speaker: params.section.speaker_id || '',
  intent: '',
  subject: '',
  action: '',
  action_str: '',
  obj: '',
});

const createVad = (vad?: ImportedVad) => ({
  valence: Number(vad?.valence ?? 0),
  arousal: Number(vad?.arousal ?? 0),
  dominance: Number(vad?.dominance ?? 0),
});

const createSpeakerThumbnail = (speakerId: string) => {
  const colorIndex = speakerId.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0) % SPEAKER_THUMBNAIL_COLORS.length;
  const label = speakerId.slice(-2) || 'ID';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="18" fill="${SPEAKER_THUMBNAIL_COLORS[colorIndex]}"/>
      <circle cx="48" cy="36" r="18" fill="rgba(255,255,255,0.78)"/>
      <path d="M18 84c5-19 17-29 30-29s25 10 30 29" fill="rgba(255,255,255,0.78)"/>
      <text x="48" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const normalizeCategoryValue = (value?: string | null) => {
  const normalized = `${value ?? ''}`.trim();
  return normalized;
};

const addCategory = (categories: CategoryAccumulator, key: keyof CategoryAccumulator, value?: string | null) => {
  const normalized = normalizeCategoryValue(value);
  if (!normalized || normalized === 'NA') {
    return;
  }
  categories[key].add(normalized);
};

const getImportedIntent = (verbal: ImportedVerbal, key: 'fc_intent' | 'bc_intent') => {
  const splitIntent = normalizeCategoryValue(verbal[key]);
  if (splitIntent && splitIntent !== 'none') {
    return splitIntent;
  }

  const legacyIntent = normalizeCategoryValue(verbal.intent);
  if (legacyIntent && legacyIntent !== 'none') {
    return legacyIntent;
  }

  return '';
};

const createCategorySet = (): CategoryAccumulator => ({
  affectiveList: new Set<string>(),
  channelList: new Set<string>(),
  sentimentList: new Set<string>(),
  fcIntentList: new Set<string>(),
  bcIntentList: new Set<string>(),
  emotionList: new Set<string>(),
  verbalVADList: new Set<string>(),
  overallVADList: new Set<string>(),
  paraverbalList: new Set<string>(),
  angleList: new Set<string>(),
  gSubjectList: new Set<string>(),
  gActionList: new Set<string>(),
  gObjectList: new Set<string>(),
  intentList: new Set<string>(),
  funcList: new Set<string>(),
  nonVerbalEmotionList: new Set<string>(),
  nonVerbalAffectiveList: new Set<string>(),
});

const buildCategoryDepth = (values: Set<string>): IJobCategoryListDepth[] =>
  Array.from(values)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      ctg_id: value,
      ctg_name: value,
      ctg_depth: [],
    }));

const buildCategoryRoot = (key: string, values: Set<string>): CategoryRoot => ({
  ctg_id: key,
  ctg_name: key,
  ctg_depth: buildCategoryDepth(values),
});

const buildCategoryState = (categories: CategoryAccumulator): ImportedViewerProject['categoryState'] => ({
  affectiveList: buildCategoryRoot('affective', categories.affectiveList),
  channelList: buildCategoryRoot('channel', categories.channelList),
  sentimentList: buildCategoryRoot('sentiment', categories.sentimentList),
  fcIntentList: buildCategoryRoot('fc_intent', categories.fcIntentList),
  bcIntentList: buildCategoryRoot('bc_intent', categories.bcIntentList),
  emotionList: buildCategoryRoot('emotion', categories.emotionList),
  verbalVADList: buildCategoryRoot('verbal_vad', categories.verbalVADList),
  overallVADList: buildCategoryRoot('overall_vad', categories.overallVADList),
  paraverbalList: buildCategoryDepth(categories.paraverbalList),
  angleList: buildCategoryRoot('angle', categories.angleList),
  gSubjectList: buildCategoryRoot('g_subject', categories.gSubjectList),
  gActionList: buildCategoryRoot('g_action', categories.gActionList),
  gObjectList: buildCategoryRoot('g_object', categories.gObjectList),
  intentList: buildCategoryRoot('intent', categories.intentList),
  funcList: buildCategoryRoot('func', categories.funcList),
  nonVerbalEmotionList: buildCategoryRoot('non_verbal_emotion', categories.nonVerbalEmotionList),
  nonVerbalAffectiveList: buildCategoryRoot('non_verbal_affective', categories.nonVerbalAffectiveList),
});

const getRelativePathParts = (file: ImportedFile) => file.webkitRelativePath.split('/').filter(Boolean);

const isHiddenOrSystemFile = (file: ImportedFile) => {
  const pathParts = getRelativePathParts(file);
  return file.name === 'Thumbs.db' || pathParts.some((part) => part.startsWith('.'));
};

const getFileByName = (filesByName: Map<string, ImportedFile>, fileName: string) => filesByName.get(fileName.toLowerCase());

const getExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || '';

const getImageMimeType = (fileName: string) => {
  const extension = getExtension(fileName);
  if (extension === 'jpg') {
    return 'image/jpeg';
  }
  return SPEAKER_THUMBNAIL_EXTENSIONS.has(extension) ? `image/${extension}` : '';
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createSubsetFolderNameRegex = (rootName: string) => new RegExp(`^${escapeRegExp(rootName)}_S\\d{3}$`);

const isSpeakerThumbnailFile = (file: ImportedFile, rootName: string) => {
  const parts = getRelativePathParts(file);
  return parts.length === 3 && parts[0] === rootName && parts[1] === SPEAKER_THUMBNAIL_FOLDER_NAME && SPEAKER_THUMBNAIL_EXTENSIONS.has(getExtension(file.name));
};

const createImportedFileUrl = (file: ImportedFile, objectUrls: string[]) => {
  if (file.dataUrl) {
    return file.dataUrl;
  }
  if (file.fileUrl) {
    return file.fileUrl;
  }
  const objectUrl = URL.createObjectURL(file);
  objectUrls.push(objectUrl);
  return objectUrl;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const createImportedImageDataUrl = async (file: ImportedFile, objectUrls: string[]) => {
  if (file.dataUrl) {
    return file.dataUrl;
  }

  const imageMimeType = getImageMimeType(file.name);
  if (imageMimeType && typeof file.arrayBuffer === 'function') {
    return `data:${imageMimeType};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;
  }

  return createImportedFileUrl(file, objectUrls);
};

const createJobFile = (file: ImportedFile, index: number, fileType: 'VIDEO' | 'AUDIO', objectUrls: string[]): IJobFileList => {
  return {
    file_id: `${fileType.toLowerCase()}-${index}-${file.name}`,
    file_type: fileType,
    file_name: file.name,
    file_url: createImportedFileUrl(file, objectUrls),
  };
};

const createFileState = (
  subsetData: ImportedSubsetData,
  filesByName: Map<string, ImportedFile>,
  objectUrls: string[],
): ImportedSubsetViewerState['fileState'] => {
  const videoList =
    subsetData.video_name_set?.flatMap((fileName, index) => {
      const file = getFileByName(filesByName, fileName);
      return file ? [createJobFile(file, index, 'VIDEO', objectUrls)] : [];
    }) ?? [];
  const audioList =
    subsetData.audio_name_set?.flatMap((fileName, index) => {
      const file = getFileByName(filesByName, fileName);
      return file ? [createJobFile(file, index, 'AUDIO', objectUrls)] : [];
    }) ?? [];

  return {
    videoList,
    audioList,
    selectVideoId: videoList[0] ?? null,
    selectAudioId: audioList[0] ?? null,
  };
};

const buildSectionMap = (sections: ImportedSection[] = []) =>
  new Map(sections.flatMap((section) => (section.section_id ? [[section.section_id, section] as const] : [])));

const buildOverallMap = (overallList: ImportedOverall[] = []) =>
  new Map(overallList.flatMap((overall) => (overall.section_id ? [[overall.section_id, overall] as const] : [])));

const parseTimeToMillis = (value?: string | number) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) {
    return 0;
  }
  const [hours = '0', minutes = '0', seconds = '0'] = value.split(':');
  const totalSeconds = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return Number.isFinite(totalSeconds) ? Math.round(totalSeconds * 1000) : 0;
};

const createVoiceMeasurements = (section: ImportedSection, paraverbal: ImportedParaverbal): IVoiceMeasurements[] => {
  const startTime = parseTimeToMillis(section.start_time);
  const endTime = parseTimeToMillis(section.end_time);
  const loudness = paraverbal.loudness ?? [];
  const pitch = paraverbal.pitch ?? [];
  const pointCount = Math.max(loudness.length, pitch.length);
  if (pointCount === 0) {
    return [];
  }
  return Array.from({ length: pointCount }, (_, index) => {
    const ratio = pointCount === 1 ? 0 : index / (pointCount - 1);
    return {
      offset_millis: Math.round(startTime + (endTime - startTime) * ratio),
      loudness: Number(loudness[index] ?? 0) || 0,
      pitch: Number(pitch[index] ?? 0) || 0,
    };
  });
};

const collectSpeakerIds = (data: ImportedDataJson, sections: ImportedSection[]) => {
  const speakerIds = new Set<string>();
  data.mainset_info?.speaker_info?.speaker_ids?.forEach((speakerId) => speakerId && speakerIds.add(speakerId));
  data.mainset_info?.speaker_info?.speaker_profiles?.forEach((profile) => profile.speaker_id && speakerIds.add(profile.speaker_id));
  sections.forEach((section) => section.speaker_id && speakerIds.add(section.speaker_id));
  return Array.from(speakerIds).sort((a, b) => a.localeCompare(b));
};

const isPlaceholderTargetId = (targetId: string) => targetId === '000';

const getImportedGazeList = (subsetData: ImportedSubsetData, information: ImportedDialogueInformation) => {
  if (Array.isArray(subsetData.gaze)) {
    return subsetData.gaze;
  }
  return information.gaze ?? [];
};

const collectGazeSpeakerIds = (gazeList: ImportedGaze[] = []) => {
  const speakerIds = new Set<string>();
  gazeList.forEach((gaze) => {
    const speakerId = normalizeCategoryValue(gaze.speaker_id);
    const targetId = normalizeCategoryValue(gaze.target_id);
    if (speakerId) {
      speakerIds.add(speakerId);
    }
    if (targetId && !isPlaceholderTargetId(targetId)) {
      speakerIds.add(targetId);
    }
  });
  return Array.from(speakerIds);
};

const collectProjectSpeakerIds = (data: ImportedDataJson, sets: ImportedSubsetData[]) => {
  const speakerIds = new Set<string>();
  collectSpeakerIds(data, []).forEach((speakerId) => speakerIds.add(speakerId));
  sets.forEach((set) => {
    collectSpeakerIds(data, set.dialogue?.section ?? []).forEach((speakerId) => speakerIds.add(speakerId));
    collectGazeSpeakerIds(getImportedGazeList(set, set.dialogue?.information ?? {})).forEach((speakerId) => speakerIds.add(speakerId));
  });
  return Array.from(speakerIds).sort((a, b) => a.localeCompare(b));
};

const createSpeakerThumbnailMap = async (files: ImportedFile[], rootName: string, speakerIds: string[], objectUrls: string[]) => {
  const thumbnailFiles = files.filter((file) => isSpeakerThumbnailFile(file, rootName));
  const speakerThumbnailMap = new Map<string, string>();
  for (const speakerId of speakerIds) {
    const thumbnailFile = thumbnailFiles.find((file) => file.name.includes(speakerId));
    if (!thumbnailFile) {
      continue;
    }
    speakerThumbnailMap.set(speakerId, await createImportedImageDataUrl(thumbnailFile, objectUrls));
  }
  return speakerThumbnailMap;
};

const buildLabelingState = (
  data: ImportedDataJson,
  subsetData: ImportedSubsetData,
  categories: CategoryAccumulator,
  speakerThumbnailMap: Map<string, string>,
): ImportedSubsetViewerState['labelingState'] => {
  const sections = subsetData.dialogue?.section ?? [];
  const sectionMap = buildSectionMap(sections);
  const information = subsetData.dialogue?.information ?? {};
  const importedGazeList = getImportedGazeList(subsetData, information);
  const overallMap = buildOverallMap(information.overall);
  const verbalList =
    information.verbal
      ?.flatMap((verbal) => {
        const section = verbal.section_id ? sectionMap.get(verbal.section_id) : undefined;
        if (!section || !verbal.section_id) {
          return [];
        }
        const overall = overallMap.get(verbal.section_id);
        const isBackChannel = verbal.channel === 'back';
        const fcIntent = isBackChannel ? '' : getImportedIntent(verbal, 'fc_intent');
        const bcIntent = isBackChannel ? getImportedIntent(verbal, 'bc_intent') : '';
        addCategory(categories, 'affectiveList', overall?.affective_state);
        addCategory(categories, 'channelList', verbal.channel);
        addCategory(categories, 'sentimentList', verbal.sentiment);
        addCategory(categories, 'fcIntentList', fcIntent);
        addCategory(categories, 'bcIntentList', bcIntent);
        addCategory(categories, 'emotionList', verbal.emotion);

        return [
          {
            ...createEmptyLabeling({ section, labelingId: verbal.section_id, verbalId: verbal.section_id }),
            sentence: verbal.sentence || '',
            channel: verbal.channel || '',
            sentiment: verbal.sentiment || '',
            fc_intent: fcIntent,
            bc_intent: bcIntent,
            emotion: verbal.emotion || '',
            affective_state: overall?.affective_state || '',
            verbal_vad: createVad(overall?.vad?.vp),
            overall_vad: createVad(overall?.vad?.vpn),
          },
        ];
      })
      .sort((a, b) => a.start_time - b.start_time) ?? [];

  const voiceMeasurementsBySpeakerId: Record<string, IVoiceMeasurements[]> = {};
  const paraverbalList =
    information['para-verbal']?.flatMap((paraverbal) => {
      const baseSection = paraverbal.section_id ? sectionMap.get(paraverbal.section_id) : undefined;
      if (baseSection?.speaker_id) {
        voiceMeasurementsBySpeakerId[baseSection.speaker_id] = [
          ...(voiceMeasurementsBySpeakerId[baseSection.speaker_id] ?? []),
          ...createVoiceMeasurements(baseSection, paraverbal),
        ];
      }

      return (
        paraverbal['para-verbal_ft']?.flatMap((feature) => {
          const section = feature.section_id ? sectionMap.get(feature.section_id) : baseSection;
          if (!section || !feature.section_id) {
            return [];
          }
          addCategory(categories, 'paraverbalList', feature.function);
          return [
            {
              ...createEmptyLabeling({ section, labelingId: feature.section_id, paraverbalId: feature.section_id }),
              func: feature.function || '',
            },
          ];
        }) ?? []
      );
    }) ?? [];

  const nonVerbalList =
    information['non-verbal']
      ?.flatMap((nonverbal) => {
        const section = nonverbal.section_id ? sectionMap.get(nonverbal.section_id) : undefined;
        if (!section || !nonverbal.section_id) {
          return [];
        }
        const gesture = nonverbal.body?.gesture;
        addCategory(categories, 'angleList', nonverbal.camera_angle);
        addCategory(categories, 'gSubjectList', gesture?.subject);
        addCategory(categories, 'gActionList', gesture?.action?.main);
        addCategory(categories, 'gObjectList', gesture?.object);
        addCategory(categories, 'intentList', nonverbal['non-verbal_only']?.intent);
        addCategory(categories, 'funcList', nonverbal.body?.function);
        addCategory(categories, 'nonVerbalEmotionList', nonverbal.body?.emotion);
        addCategory(categories, 'nonVerbalAffectiveList', nonverbal['non-verbal_only']?.affective_state);

        return [
          {
            ...createEmptyLabeling({ section, labelingId: nonverbal.section_id, nonverbalId: nonverbal.section_id }),
            angle: nonverbal.camera_angle || '',
            subject: gesture?.subject || '',
            action: gesture?.action?.main || '',
            action_str: gesture?.action?.description || '',
            obj: gesture?.object || '',
            intent: nonverbal['non-verbal_only']?.intent || '',
            func: nonverbal.body?.function || '',
            emotion: nonverbal.body?.emotion || '',
            affective_state: nonverbal['non-verbal_only']?.affective_state || '',
          },
        ];
      })
      .sort((a, b) => a.start_time - b.start_time) ?? [];

  const gazeList =
    importedGazeList
      ?.flatMap((gaze, index) => {
        const speakerId = normalizeCategoryValue(gaze.speaker_id);
        const targetId = normalizeCategoryValue(gaze.target_id);
        const startTime = parseTimeToMillis(gaze.start_time);
        const endTime = parseTimeToMillis(gaze.end_time);
        if (!speakerId || !targetId || endTime <= startTime) {
          return [];
        }

        return [
          {
            speaker_id: speakerId,
            target_id: targetId,
            start_time: startTime,
            end_time: endTime,
            gaze_id: `${speakerId}-${targetId}-${startTime}-${endTime}-${index}`,
          },
        ];
      })
      .sort((a, b) => a.start_time - b.start_time) ?? [];

  const speakerIds = Array.from(new Set([...collectSpeakerIds(data, sections), ...collectGazeSpeakerIds(importedGazeList)])).sort((a, b) => a.localeCompare(b));
  const list = speakerIds.map((speakerId) => ({
    verbalList: verbalList.filter((labeling) => labeling.speaker_id === speakerId),
    paraverbalList: paraverbalList.filter((labeling) => labeling.speaker_id === speakerId),
    nonVerbalList: nonVerbalList.filter((labeling) => labeling.speaker_id === speakerId),
    gazeList: gazeList.filter((labeling) => labeling.speaker_id === speakerId),
    speakers: {
      speaker_id: speakerId,
      thumbnail_file_url: speakerThumbnailMap.get(speakerId) || createSpeakerThumbnail(speakerId),
    },
    voice_measurements: (voiceMeasurementsBySpeakerId[speakerId] ?? []).sort((a, b) => a.offset_millis - b.offset_millis),
  }));

  return {
    list,
    verbalList,
  };
};

const getRootName = (files: ImportedFile[]) => {
  const rootNames = Array.from(new Set(files.flatMap((file) => getRelativePathParts(file)[0] || [])));
  if (rootNames.length !== 1) {
    throw new Error(`최상위 폴더는 ${MAINSET_NAME_PATTERN} 형식의 폴더 하나만 선택해야 합니다.`);
  }
  const rootName = rootNames[0];
  if (!MAINSET_NAME_REGEX.test(rootName)) {
    throw new Error(`최상위 폴더명은 ${MAINSET_NAME_PATTERN} 형식이어야 합니다. 예: SET240_M017`);
  }
  return rootName;
};

const readDataJson = async (files: ImportedFile[], rootName: string) => {
  const rootJsonFiles = files.filter((file) => {
    const parts = getRelativePathParts(file);
    return parts.length === 2 && parts[0] === rootName && isRootJsonFileName(parts[1], rootName);
  });
  const expectedRootJsonFileName = getRootJsonFileNamePattern(rootName);
  if (!rootJsonFiles.length) {
    throw new Error(`${rootName}/${expectedRootJsonFileName} 형식의 JSON 파일을 찾을 수 없습니다. {YYYYMMDDHHmmss}는 생성 시간값입니다.`);
  }
  if (rootJsonFiles.length > 1) {
    throw new Error(`Mainset JSON 파일은 하나만 둘 수 있습니다. 감지된 파일: ${rootJsonFiles.map((file) => file.name).join(', ')}`);
  }
  try {
    return JSON.parse(await rootJsonFiles[0].text()) as ImportedDataJson;
  } catch {
    throw new Error(`${rootJsonFiles[0].name} 파싱에 실패했습니다. JSON 형식을 확인해주세요.`);
  }
};

const buildFilesByName = (files: ImportedFile[], rootName: string) =>
  new Map(
    files.flatMap((file) => {
      const parts = getRelativePathParts(file);
      if (parts.length < 3 || parts[0] !== rootName) {
        return [];
      }
      return [[file.name.toLowerCase(), file] as const];
    }),
  );

const getSubsetFolderName = (file: ImportedFile, rootName: string) => {
  const parts = getRelativePathParts(file);
  if (parts.length < 3 || parts[0] !== rootName || !createSubsetFolderNameRegex(rootName).test(parts[1])) {
    return null;
  }
  return parts[1];
};

const getMediaFileNamesBySubset = (files: ImportedFile[], rootName: string) => {
  return files.reduce<Record<string, { videoNames: string[]; audioNames: string[] }>>((acc, file) => {
    const subsetId = getSubsetFolderName(file, rootName);
    if (!subsetId) {
      return acc;
    }
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'mp4' && extension !== 'wav') {
      return acc;
    }
    if (!acc[subsetId]) {
      acc[subsetId] = { videoNames: [], audioNames: [] };
    }
    if (extension === 'mp4') {
      acc[subsetId].videoNames.push(file.name);
    }
    if (extension === 'wav') {
      acc[subsetId].audioNames.push(file.name);
    }
    return acc;
  }, {});
};

const mergeDataAndFolderSubsets = (dataSets: ImportedSubsetData[], files: ImportedFile[], rootName: string) => {
  const mediaFileNamesBySubset = getMediaFileNamesBySubset(files, rootName);
  const dataSetsBySubsetId = new Map(dataSets.flatMap((set) => (set.subset_id ? [[set.subset_id, set] as const] : [])));
  Object.entries(mediaFileNamesBySubset).forEach(([subsetId, mediaFileNames]) => {
    if (dataSetsBySubsetId.has(subsetId)) {
      return;
    }
    dataSetsBySubsetId.set(subsetId, {
      subset_id: subsetId,
      video_name_set: mediaFileNames.videoNames.sort((a, b) => a.localeCompare(b)),
      audio_name_set: mediaFileNames.audioNames.sort((a, b) => a.localeCompare(b)),
      dialogue: {
        section: [],
        information: {},
      },
    });
  });
  return Array.from(dataSetsBySubsetId.values()).sort((a, b) => (a.subset_id || '').localeCompare(b.subset_id || ''));
};

const assertReferencedFilesExist = (sets: ImportedSubsetData[], filesByName: Map<string, ImportedFile>) => {
  const missingFiles = sets.flatMap((subsetData) =>
    [...(subsetData.video_name_set ?? []), ...(subsetData.audio_name_set ?? [])].flatMap((fileName) =>
      filesByName.has(fileName.toLowerCase()) ? [] : [`${subsetData.subset_id || 'unknown subset'} / ${fileName}`],
    ),
  );
  if (missingFiles.length > 0) {
    throw new Error(`Mainset JSON에 있지만 폴더에서 찾을 수 없는 파일이 있습니다: ${missingFiles.slice(0, 6).join(', ')}`);
  }
};

const getSubsetName = (subsetId: string, mainsetId: string) => subsetId.replace(`${mainsetId}_`, '') || subsetId;

const createImportedViewerProject = async (selectedFiles: File[]): Promise<ImportedViewerProject> => {
  const files = (selectedFiles as ImportedFile[]).filter((file) => !isHiddenOrSystemFile(file));
  const rootName = getRootName(files);
  const data = await readDataJson(files, rootName);
  const mainsetId = data.mainset_info?.mainset_id || rootName;
  if (mainsetId !== rootName) {
    throw new Error(`선택한 폴더명(${rootName})과 Mainset JSON mainset_id(${mainsetId})가 일치해야 합니다.`);
  }
  const dataSets = data.subset_info?.sets ?? [];
  const sets = mergeDataAndFolderSubsets(dataSets, files, rootName);
  if (sets.length === 0) {
    throw new Error('Mainset JSON 안에 subset_info.sets 데이터가 없고, 폴더에서도 Subset을 찾을 수 없습니다.');
  }

  const filesByName = buildFilesByName(files, rootName);
  assertReferencedFilesExist(sets, filesByName);
  const objectUrls: string[] = [];
  const speakerThumbnailMap = await createSpeakerThumbnailMap(files, rootName, collectProjectSpeakerIds(data, sets), objectUrls);
  const categories = createCategorySet();
  const jobs = sets.flatMap((subsetData) => {
    if (!subsetData.subset_id) {
      return [];
    }
    return [
      {
        job_id: subsetData.subset_id,
        job_name: getSubsetName(subsetData.subset_id, mainsetId),
        working: false,
        is_access: true,
      },
    ];
  });
  const subsetsByJobId = sets.reduce<Record<string, ImportedSubsetViewerState>>((acc, subsetData) => {
    const job = jobs.find((item) => item.job_id === subsetData.subset_id);
    if (!job) {
      return acc;
    }
    acc[job.job_id] = {
      job,
      fileState: createFileState(subsetData, filesByName, objectUrls),
      labelingState: buildLabelingState(data, subsetData, categories, speakerThumbnailMap),
    };
    return acc;
  }, {});

  if (jobs.length === 0) {
    throw new Error('Mainset JSON에서 유효한 subset_id를 찾을 수 없습니다.');
  }

  return {
    projectName: mainsetId,
    jobs,
    subsetsByJobId,
    categoryState: buildCategoryState(categories),
    objectUrls,
  };
};

export { createImportedViewerProject, parseTimeToMillis };
export type { ImportedViewerProject };

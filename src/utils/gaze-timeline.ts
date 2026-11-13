export interface GazeTimelineSegment {
  speaker_id: string;
  target_id: string;
  start_time: number;
  end_time: number;
  gaze_id?: string;
}

const normalizeId = (value?: string | null) => `${value ?? ''}`.trim();

const uniqueIds = (ids: string[]) =>
  ids.reduce<string[]>((acc, id) => {
    const normalizedId = normalizeId(id);
    if (normalizedId && !acc.includes(normalizedId)) {
      acc.push(normalizedId);
    }
    return acc;
  }, []);

export const getGazeTargetIds = (speakerIds: string[], speakerId: string) => {
  const currentSpeakerId = normalizeId(speakerId);
  return uniqueIds(speakerIds)
    .filter((targetId) => targetId !== currentSpeakerId)
    .sort((a, b) => a.localeCompare(b));
};

export const getVisibleGazeSegments = <T extends GazeTimelineSegment>(segments: T[], speakerId: string, speakerIds: string[]) => {
  const currentSpeakerId = normalizeId(speakerId);
  const targetIds = new Set(getGazeTargetIds(speakerIds, currentSpeakerId));

  return segments
    .filter((segment) => {
      const startTime = Number(segment.start_time);
      const endTime = Number(segment.end_time);
      return (
        normalizeId(segment.speaker_id) === currentSpeakerId &&
        targetIds.has(normalizeId(segment.target_id)) &&
        Number.isFinite(startTime) &&
        Number.isFinite(endTime) &&
        endTime > startTime
      );
    })
    .sort((a, b) => a.start_time - b.start_time || a.end_time - b.end_time || normalizeId(a.target_id).localeCompare(normalizeId(b.target_id)));
};

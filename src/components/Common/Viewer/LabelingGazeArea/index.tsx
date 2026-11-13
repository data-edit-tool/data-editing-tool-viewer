import { useMemo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { currentSectionAtom } from 'state/current-section.atom';
import durationAtom from 'state/duration.atom';
import { scrollWidthAtom } from 'state/scrollWidth.atom';
import { seekingTimeAtom } from 'state/seeking-time.atom';
import { selectedSectionAtom } from 'state/selected-section.atom';
import { styled } from 'styled-components';
import { ILabelingGaze } from 'types/worker-interface';

const LabelingGazeAreaWrapper = styled.div`
  width: 100%;
  height: 24px;
  background-color: #050609;
  position: relative;
  margin-top: 8px;
  overflow: hidden;
`;

const GazeTargetSegment = styled.button<{ $borderColor: string; $segmentWidth: number }>`
  position: absolute;
  top: 3px;
  height: 18px;
  padding: 0 8px;
  border: 1px solid ${({ $borderColor }) => $borderColor};
  border-radius: 2px;
  background: ${({ $borderColor }) => `${$borderColor}16`};
  color: #f7f8fd;
  cursor: pointer;
  font-size: ${({ $segmentWidth }) => ($segmentWidth >= 34 ? '12px' : '0px')};
  font-weight: 700;
  line-height: 16px;
  overflow: hidden;
  text-align: center;
  white-space: nowrap;
  span {
    display: block;
    opacity: ${({ $segmentWidth }) => ($segmentWidth >= 34 ? 1 : 0)};
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const GAZE_TARGET_COLORS = ['#a7cf17', '#a64ee8', '#28c4b0', '#f3a340', '#e85b7d', '#4ea8ff', '#ff6b35', '#d6d12f'];

interface ILabelingGazeArea {
  list: ILabelingGaze[];
  targetIds: string[];
}

const getTargetColor = (targetId: string, targetIds: string[]) => {
  const targetIndex = targetIds.indexOf(targetId);
  if (targetIndex >= 0) {
    return GAZE_TARGET_COLORS[targetIndex % GAZE_TARGET_COLORS.length];
  }
  const hash = targetId.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return GAZE_TARGET_COLORS[hash % GAZE_TARGET_COLORS.length];
};

const LabelingGazeArea: React.FC<ILabelingGazeArea> = ({ list, targetIds }) => {
  const scrollWith = useRecoilValue(scrollWidthAtom);
  const duration = useRecoilValue(durationAtom);
  const setSeekingTime = useSetRecoilState(seekingTimeAtom);
  const setSelectedSection = useSetRecoilState(selectedSectionAtom);
  const setCurrentSection = useSetRecoilState(currentSectionAtom);
  const pxPerSec = duration ? scrollWith / duration : 0;
  const sortedList = useMemo(() => [...list].sort((a, b) => a.start_time - b.start_time), [list]);

  const handleClick = (gaze: ILabelingGaze) => {
    const startTime = gaze.start_time / 1000;
    const endTime = gaze.end_time / 1000;
    setSeekingTime(startTime);
    setSelectedSection([]);
    setCurrentSection({
      id: gaze.gaze_id,
      startTime,
      endTime,
    });
  };

  return (
    <LabelingGazeAreaWrapper>
      {Boolean(pxPerSec) &&
        sortedList.map((gaze) => {
          const startTime = gaze.start_time / 1000;
          const endTime = gaze.end_time / 1000;
          const width = Math.max(2, (endTime - startTime) * pxPerSec);
          const borderColor = getTargetColor(gaze.target_id, targetIds);
          return (
            <GazeTargetSegment
              key={gaze.gaze_id}
              type="button"
              $borderColor={borderColor}
              $segmentWidth={width}
              aria-label={`${gaze.speaker_id} gaze target ${gaze.target_id}`}
              title={gaze.target_id}
              style={{
                left: startTime * pxPerSec,
                width,
              }}
              onClick={() => handleClick(gaze)}
            >
              <span>{gaze.target_id}</span>
            </GazeTargetSegment>
          );
        })}
    </LabelingGazeAreaWrapper>
  );
};

export default LabelingGazeArea;

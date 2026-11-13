import { useRecoilValue } from 'recoil';
import { viewerProjectSelector } from 'state/viewer-project';
import { styled } from 'styled-components';

const WorkerHeaderWrapper = styled.div`
  width: 100%;
  background-color: #151b27;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px;
  position: relative;
  .back-btn {
    width: 152px;
    color: ${({ theme }) => theme.workerColor.txt2};
  }

  .title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 16px;
    font-weight: 500;
    color: ${({ theme }) => theme.workerColor.white};
  }
  .btn-wrapper {
    display: flex;
    justify-content: flex-end;
    width: 152px;
    .exit-btn {
      width: 72px;
      height: 32px;
      border: 1px solid rgba(170, 174, 178, 0.24);
      border-radius: 4px;
      background-color: #263147;
      color: ${({ theme }) => theme.workerColor.txt2};
      font-weight: bold;
      cursor: pointer;

      &:hover {
        background-color: #33405b;
        color: ${({ theme }) => theme.workerColor.white};
      }
    }
  }
`;

interface ViewerHeaderProps {
  onExit?: () => void;
}

const ViewerHeader = ({ onExit }: ViewerHeaderProps) => {
  const projectName = useRecoilValue(viewerProjectSelector);

  return (
    <WorkerHeaderWrapper>
      <div className="back-btn" />
      <div className="title">{projectName || 'Labeling tool'}</div>
      <div className="btn-wrapper">
        {onExit && (
          <button className="exit-btn" type="button" onClick={onExit}>
            종료
          </button>
        )}
      </div>
    </WorkerHeaderWrapper>
  );
};

export default ViewerHeader;

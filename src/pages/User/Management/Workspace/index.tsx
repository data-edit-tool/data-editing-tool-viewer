import { useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { userWorkspaceManagementListSelector } from 'state/user-workspace-management';
import styled from 'styled-components';

import Button from 'components/Common/Admin/Button';
import Title from 'components/Common/Admin/Title';
import Card from 'components/Common/User/Card';
import Layout from 'components/Layout';
import Header from 'components/Layout/Header';
import ModalContainer from 'components/Modal';

const Container = styled.section`
  padding: 34px 40px 40px;
  overflow-x: auto;
  & > ul {
    gap: 20px;
    margin-top: 20px;
    display: flex;
    flex-wrap: wrap;
    & > li {
      /* &:nth-of-type(n + 5) {
        margin-top: 20px;
      } */
      &:nth-of-type(4n) {
        margin-right: 0;
      }
    }
  }
`;

const ImportModalContainer = styled.div`
  .overlay {
    position: fixed;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background-color: ${({ theme }) => theme.adminColor.black};
    opacity: 0.5;
    z-index: 7001;
    backdrop-filter: blur(2px);
  }
  .modal-main {
    z-index: 7002;
    position: fixed;
    width: min(1180px, 94vw);
    max-height: 86vh;
    padding: 28px 28px 24px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    margin: 0 auto;
    background: linear-gradient(180deg, #ffffff 0%, #f7f8fa 100%);
    border-radius: 16px;
    box-shadow: 0 2px 12px 0 rgba(18, 44, 72, 0.2);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .title {
    color: ${({ theme }) => theme.adminColor.txt2};
    font-weight: 700;
    font-size: ${({ theme }) => theme.fontSize.text_18};
  }
  .count {
    padding: 6px 10px;
    border-radius: 999px;
    background-color: ${({ theme }) => theme.adminColor.white};
    border: 1px solid #e6e9ef;
    color: ${({ theme }) => theme.adminColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_12};
  }
  .content {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(420px, 2fr);
    gap: 18px;
    flex: 1;
    min-height: 140px;
    overflow: hidden;
    align-items: start;
  }
  .video-list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    overflow: auto;
    padding-right: 6px;
    max-height: 62vh;
  }
  .video-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: ${({ theme }) => theme.adminColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_12};
    padding: 10px;
    background-color: ${({ theme }) => theme.adminColor.white};
    border: 1px solid #e6e9ef;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(18, 44, 72, 0.08);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    cursor: pointer;
    text-align: left;
    width: 100%;
    appearance: none;
    font-family: inherit;
    &:focus-visible {
      outline: 2px solid #96b7ff;
      outline-offset: 2px;
    }
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(18, 44, 72, 0.12);
    }
    &.active {
      border-color: #f2b36e;
      box-shadow: 0 6px 14px rgba(242, 179, 110, 0.25);
    }
  }
  .video-thumb {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    background-color: #101316;
    border-radius: 10px;
  }
  .player {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background-color: #0f1115;
    border-radius: 16px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    align-items: center;
  }
  .player video {
    width: 100%;
    height: auto;
    border-radius: 12px;
    background-color: #000;
    max-height: 62vh;
  }
  .player-title {
    color: #f5f6f7;
    font-size: ${({ theme }) => theme.fontSize.text_14};
    font-weight: 600;
  }
  .player-empty {
    color: #c9cbd1;
    font-size: ${({ theme }) => theme.fontSize.text_14};
  }
  .video-name {
    font-weight: 600;
    color: #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty {
    color: ${({ theme }) => theme.adminColor.txt2};
    font-size: ${({ theme }) => theme.fontSize.text_14};
    padding: 8px 0;
  }
  .btn-wrapper {
    display: flex;
    justify-content: flex-end;
  }
  @media (max-width: 920px) {
    .content {
      grid-template-columns: 1fr;
    }
    .video-list {
      max-height: 220px;
    }
  }
`;

type SelectedVideo = {
  name: string;
  url: string;
  file: File;
};

const UserManagementWorkspace = () => {
  const sidebarList = useRecoilValue(userWorkspaceManagementListSelector);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importVideos, setImportVideos] = useState<SelectedVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<SelectedVideo | null>(null);

  const revokeVideoUrls = (videos: SelectedVideo[]) => {
    videos.forEach((video) => URL.revokeObjectURL(video.url));
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selected = Array.from(files)
        .filter((file) => file.type.startsWith('video/'))
        .map((file) => ({
          file,
          name: file.name,
          url: URL.createObjectURL(file),
        }));
      revokeVideoUrls(importVideos);
      setImportVideos(selected);
      setActiveVideo(selected[0] ?? null);
      setImportModalOpen(true);
    }
    // 같은 파일을 다시 선택할 수 있도록 reset
    e.target.value = '';
  };

  const handleImportConfirm = () => {
    setImportModalOpen(false);
    revokeVideoUrls(importVideos);
    setImportVideos([]);
    setActiveVideo(null);
  };

  const handleImportClose = () => {
    setImportModalOpen(false);
    revokeVideoUrls(importVideos);
    setImportVideos([]);
    setActiveVideo(null);
  };

  return (
    <Layout type="user">
      <Header>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <b>Home</b>
        </div>
      </Header>
      <Container>
        <Title
          className="title-box"
          title="Home"
          button={
            <div style={{ position: 'relative' }}>
              <input
                ref={fileInputRef}
                type="file"
                {...({ webkitdirectory: '', directory: '' } as any)}
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <Button
                variant="secondary"
                size="m"
                style={{
                  width: '166px',
                }}
                onClick={handleImportClick}
              >
                프로젝트 Import
              </Button>
            </div>
          }
        />
        <ul>
          {sidebarList.map((item) => (
            <Card key={item.workspace_id} workspace={item} isViewer={false} />
          ))}
        </ul>
      </Container>
      {importModalOpen && (
        <ModalContainer id="modal">
          <ImportModalContainer>
            <div className="overlay" onClick={handleImportClose} />
            <div className="modal-main">
              <div className="modal-header">
                <div className="title">프로젝트 Import 미리보기</div>
                <div className="count">{importVideos.length}개</div>
              </div>
              {importVideos.length === 0 ? (
                <div className="empty">선택한 폴더에 영상 파일이 없습니다.</div>
              ) : (
                <div className="content">
                  <div className="video-list">
                    {importVideos.map((video) => (
                      <button
                        type="button"
                        className={`video-item${activeVideo?.url === video.url ? ' active' : ''}`}
                        key={video.url}
                        onClick={() => setActiveVideo(video)}
                      >
                        <video className="video-thumb" src={video.url} muted playsInline preload="metadata" />
                        <span className="video-name">{video.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="player">
                    {activeVideo ? (
                      <>
                        <div className="player-title">{activeVideo.name}</div>
                        <video controls playsInline preload="metadata" src={activeVideo.url} key={activeVideo.url} />
                      </>
                    ) : (
                      <div className="player-empty">재생할 영상을 선택해주세요.</div>
                    )}
                  </div>
                </div>
              )}
              <div className="btn-wrapper">
                <Button onClick={handleImportConfirm}>확인</Button>
              </div>
            </div>
          </ImportModalContainer>
        </ModalContainer>
      )}
    </Layout>
  );
};

export default UserManagementWorkspace;

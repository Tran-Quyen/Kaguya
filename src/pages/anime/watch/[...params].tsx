import { WatchPlayerProps } from "@/components/features/anime/WatchPlayer";
import Button from "@/components/shared/Button";
import Description from "@/components/shared/Description";
import Head from "@/components/shared/Head";
import Loading from "@/components/shared/Loading";
import Portal from "@/components/shared/Portal";
import { WatchContextProvider } from "@/contexts/WatchContext";
import useDevice from "@/hooks/useDevice";
import useEventListener from "@/hooks/useEventListener";
import { useFetchSource } from "@/hooks/useFetchSource";
import useSavedWatched from "@/hooks/useSavedWatched";
import useSaveWatched from "@/hooks/useSaveWatched";
import supabase from "@/lib/supabase";
import { getMediaDetails } from "@/services/anilist";
import { AnimeSourceConnection, Episode } from "@/types";
import { Media } from "@/types/anilist";
import { getDescription, getTitle, sortMediaUnit } from "@/utils/data";
import { GetServerSideProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
const WatchPlayer = dynamic(
  () => import("@/components/features/anime/WatchPlayer"),
  {
    ssr: false,
  }
);

interface WatchPageProps {
  anime: Media;
  episodes: Episode[];
}

const blankVideo = [
  {
    file: "https://cdn.plyr.io/static/blank.mp4",
  },
];

const ForwardRefPlayer = React.memo(
  React.forwardRef<HTMLVideoElement, WatchPlayerProps>((props, ref) => (
    <WatchPlayer {...props} videoRef={ref} />
  ))
);

ForwardRefPlayer.displayName = "ForwardRefPlayer";

const WatchPage: NextPage<WatchPageProps> = ({ anime, episodes }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { isMobile } = useDevice();
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);
  const [showWatchedOverlay, setShowWatchedOverlay] = useState(false);
  const [declinedRewatch, setDeclinedRewatch] = useState(false);

  const showInfoTimeout = useRef<NodeJS.Timeout>(null);
  const saveWatchedInterval = useRef<NodeJS.Timer>(null);
  const saveWatchedMutation = useSaveWatched();
  const { t } = useTranslation("anime_watch");

  useEventListener("visibilitychange", () => {
    if (isMobile) return;

    if (showInfoTimeout.current) {
      clearTimeout(showInfoTimeout.current);
    }

    if (!document.hidden) return;

    showInfoTimeout.current = setTimeout(() => {
      setShowInfoOverlay(true);
    }, 5000);
  });

  const { params } = router.query;

  const sortedEpisodes = useMemo(() => sortMediaUnit(episodes), [episodes]);

  const [
    animeId,
    sourceId = sortedEpisodes[0].sourceId,
    episodeId = sortedEpisodes[0].sourceEpisodeId,
  ] = params as string[];

  const {
    data: watchedEpisodeData,
    isLoading: isSavedDataLoading,
    isError: isSavedDataError,
  } = useSavedWatched(Number(animeId));

  const watchedEpisode = useMemo(
    () =>
      isSavedDataError
        ? null
        : sortedEpisodes.find(
            (episode) =>
              episode.sourceEpisodeId ===
              watchedEpisodeData?.episode?.sourceEpisodeId
          ),
    [
      isSavedDataError,
      sortedEpisodes,
      watchedEpisodeData?.episode?.sourceEpisodeId,
    ]
  );

  const sourceEpisodes = useMemo(
    () => episodes.filter((episode) => episode.sourceId === sourceId),
    [episodes, sourceId]
  );

  const currentEpisode = useMemo(
    () =>
      sourceEpisodes.find((episode) => episode.sourceEpisodeId === episodeId),
    [sourceEpisodes, episodeId]
  );

  const currentEpisodeIndex = useMemo(
    () =>
      sourceEpisodes.findIndex(
        (episode) => episode.sourceEpisodeId === episodeId
      ),
    [episodeId, sourceEpisodes]
  );

  const nextEpisode = useMemo(
    () => sourceEpisodes[currentEpisodeIndex + 1],
    [currentEpisodeIndex, sourceEpisodes]
  );

  const handleNavigateEpisode = useCallback(
    (episode: Episode) => {
      if (!episode) return;

      router.replace(
        `/anime/watch/${animeId}/${episode.sourceId}/${episode.sourceEpisodeId}`,
        null,
        {
          shallow: true,
        }
      );
    },
    [animeId, router]
  );

  const { data, isLoading, isError, error } = useFetchSource(
    currentEpisode,
    nextEpisode
  );

  // Show watched overlay
  useEffect(() => {
    if (
      !watchedEpisode ||
      isSavedDataLoading ||
      isSavedDataError ||
      declinedRewatch
    )
      return;

    if (currentEpisode.sourceEpisodeId === watchedEpisode?.sourceEpisodeId) {
      setDeclinedRewatch(true);

      return;
    }

    setShowWatchedOverlay(true);
  }, [
    currentEpisode.sourceEpisodeId,
    declinedRewatch,
    isSavedDataError,
    isSavedDataLoading,
    watchedEpisode,
  ]);

  useEffect(() => {
    const videoEl = videoRef.current;

    if (!videoEl) return;

    const handleSaveTime = () => {
      if (saveWatchedInterval.current) {
        clearInterval(saveWatchedInterval.current);
      }
      saveWatchedInterval.current = setInterval(() => {
        saveWatchedMutation.mutate({
          media_id: Number(animeId),
          episode_id: `${currentEpisode.sourceId}-${currentEpisode.sourceEpisodeId}`,
          watched_time: videoRef.current?.currentTime,
        });
      }, 30000);
    };

    videoEl.addEventListener("canplay", handleSaveTime);

    return () => {
      clearInterval(saveWatchedInterval.current);
      videoEl.removeEventListener("canplay", handleSaveTime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, currentEpisode, videoRef.current]);

  useEffect(() => {
    const videoEl = videoRef.current;

    if (!videoEl) return;
    if (isSavedDataLoading) return;
    if (!watchedEpisodeData?.watchedTime) return;

    if (watchedEpisode?.sourceEpisodeId !== currentEpisode?.sourceEpisodeId)
      return;

    const handleVideoPlay = () => {
      videoEl.currentTime = watchedEpisodeData.watchedTime;
    };

    // Only set the video time if the video is ready
    videoEl.addEventListener("canplay", handleVideoPlay, { once: true });

    return () => {
      videoEl.removeEventListener("canplay", handleVideoPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedEpisode?.sourceEpisodeId, videoRef.current]);

  const title = useMemo(
    () => getTitle(anime, router.locale),
    [anime, router.locale]
  );
  const description = useMemo(
    () => getDescription(anime, router.locale),
    [anime, router.locale]
  );

  const sources = useMemo(
    () => (!data?.sources?.length ? blankVideo : data.sources),
    [data?.sources]
  );

  const subtitles = useMemo(
    () => (!data?.subtitles?.length ? [] : data.subtitles),
    [data?.subtitles]
  );

  return (
    <WatchContextProvider
      value={{
        anime,
        currentEpisode,
        currentEpisodeIndex,
        episodes: sortedEpisodes,
        setEpisode: handleNavigateEpisode,
        sourceId,
        sources,
      }}
    >
      <div className="relative w-full h-screen">
        <Head
          title={`${title} (${currentEpisode.name}) - Kaguya`}
          description={`Xem phim ${title} (${currentEpisode.name}) tại Kaguya. Hoàn toàn miễn phí, không quảng cáo`}
          image={anime.bannerImage}
        />

        <ForwardRefPlayer
          ref={videoRef}
          sources={sources}
          subtitles={subtitles}
          className="object-contain w-full h-full"
        />

        {isLoading && (
          <Portal selector=".netplayer-container">
            <Loading />
          </Portal>
        )}

        {isError && (
          <Portal selector=".netplayer-container">
            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 space-y-4">
              <p className="text-4xl font-semibold text-center">｡゜(｀Д´)゜｡</p>
              <p className="text-xl text-center">
                Đã có lỗi xảy ra ({error?.response?.data?.error})
              </p>
              <p className="text-lg text-center">
                Bạn có thể chọn source khác hoặc thử lại sau.
              </p>
            </div>
          </Portal>
        )}

        {showInfoOverlay && (
          <Portal>
            <div
              className="fixed inset-0 z-[9999] flex items-center bg-black/70"
              onMouseMove={() => setShowInfoOverlay(false)}
            >
              <div className="w-11/12 px-40">
                <p className="mb-2 text-xl text-gray-200">
                  {t("blur_heading")}
                </p>
                <p className="mb-8 text-5xl font-semibold">
                  {title} - {currentEpisode.name}
                </p>

                <Description
                  description={description || t("common:updating") + "..."}
                  className="text-lg text-gray-300 line-clamp-6"
                />
              </div>
            </div>
          </Portal>
        )}

        {showWatchedOverlay && !declinedRewatch && (
          <Portal selector=".video-wrapper">
            <div
              className="fixed inset-0 z-40 bg-black/70"
              onClick={() => {
                setShowWatchedOverlay(false);
                setDeclinedRewatch(true);
              }}
            />

            <div className="fixed left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 w-2/3 p-8 rounded-md bg-background-900">
              <h1 className="text-4xl font-bold mb-4">
                {t("rewatch_heading", { episodeName: watchedEpisode.name })}
              </h1>
              <p className="">
                {t("rewatch_description", { episodeName: watchedEpisode.name })}
              </p>
              <p className="mb-4">
                {t("rewatch_question", { episodeName: watchedEpisode.name })}
              </p>
              <div className="flex items-center justify-end space-x-4">
                <Button
                  onClick={() => {
                    setShowWatchedOverlay(false), setDeclinedRewatch(true);
                  }}
                  className="!bg-transparent hover:!bg-white/20 transition duration-300"
                >
                  <p>{t("rewatch_no")}</p>
                </Button>
                <Button
                  onClick={() =>
                    handleNavigateEpisode(watchedEpisodeData?.episode)
                  }
                  primary
                >
                  <p>{t("rewatch_yes")}</p>
                </Button>
              </div>
            </div>
          </Portal>
        )}
      </div>
    </WatchContextProvider>
  );
};

export const getServerSideProps: GetServerSideProps = async ({
  params: { params },
}) => {
  try {
    const sourceConnectionPromise = supabase
      .from<AnimeSourceConnection>("kaguya_anime_source")
      .select(
        `
      episodes:kaguya_episodes(*, source:kaguya_sources(id, name, locales))
    `
      )
      .eq("mediaId", Number(params[0]));

    const fields = `
      id
      idMal
      title {
        userPreferred
        romaji
        native
        english
      }
      description
      bannerImage
      coverImage {
        extraLarge
        large
        medium
        color
      }
    `;

    const mediaPromise = getMediaDetails(
      {
        id: Number(params[0]),
      },
      fields
    );

    const [{ data, error }, media] = await Promise.all([
      sourceConnectionPromise,
      mediaPromise,
    ]);

    if (error) {
      throw error;
    }

    return {
      props: {
        anime: media,
        episodes: data.flatMap((connection) => connection.episodes),
      },
    };
  } catch (err) {
    console.log(err);

    return { notFound: true };
  }
};

// @ts-ignore
WatchPage.getLayout = (page) => page;

export default WatchPage;

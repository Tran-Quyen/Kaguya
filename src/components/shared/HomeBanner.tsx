import BannerSwiper from "@/components/shared/BannerSwiper";
import CircleButton from "@/components/shared/CircleButton";
import DotList from "@/components/shared/DotList";
import Image from "@/components/shared/Image";
import Swiper, { SwiperProps, SwiperSlide } from "@/components/shared/Swiper";
import TextIcon from "@/components/shared/TextIcon";
import { Media, MediaType } from "@/types/anilist";
import { numberWithCommas } from "@/utils";
import { convert, getDescription, getTitle } from "@/utils/data";
import classNames from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BrowserView, MobileView } from "react-device-detect";
import { AiFillHeart, AiFillPlayCircle } from "react-icons/ai";
import { BsFillVolumeMuteFill, BsFillVolumeUpFill } from "react-icons/bs";
import { MdTagFaces } from "react-icons/md";
import YouTube from "react-youtube";
import ListSwiperSkeleton from "../skeletons/ListSwiperSkeleton";
import Description from "./Description";
import Skeleton, { SkeletonItem } from "./Skeleton";

interface HomeBannerProps {
  data: Media[];
  type: MediaType;
  isLoading?: boolean;
}

const bannerVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const transition = [0.33, 1, 0.68, 1];

const HomeBanner: React.FC<HomeBannerProps> = ({ data, type, isLoading }) => {
  return (
    <React.Fragment>
      <BrowserView>
        {isLoading ? (
          <DesktopHomeBannerSkeleton />
        ) : (
          <DesktopHomeBanner data={data} type={type} />
        )}
      </BrowserView>

      <MobileView className="px-4 md:px-12 pt-20 pb-8 overflow-hidden">
        {isLoading ? (
          <MobileHomeBannerSkeleton />
        ) : (
          <MobileHomeBanner data={data} type={type} />
        )}
      </MobileView>
    </React.Fragment>
  );
};

const MobileHomeBanner: React.FC<HomeBannerProps> = ({ data, type }) => {
  const { locale } = useRouter();

  const getRedirectUrl = useCallback(
    (id: number) => {
      return type === MediaType.Anime
        ? `/anime/details/${id}`
        : `/manga/details/${id}`;
    },
    [type]
  );

  return (
    <Swiper
      hideNavigation
      spaceBetween={10}
      breakpoints={{}}
      slidesPerView={1}
      loop
    >
      {data.map((slide: Media, index: number) => {
        const title = getTitle(slide, locale);

        return (
          <SwiperSlide key={index}>
            <Link href={getRedirectUrl(slide.id)}>
              <a>
                <div className="relative aspect-w-16 aspect-h-9 rounded-md">
                  {slide.bannerImage && (
                    <Image
                      src={slide.bannerImage}
                      alt={title}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-md"
                    />
                  )}

                  <div className="absolute fixed-0 bg-gradient-to-b from-transparent via-black/60 to-black/80 flex items-end">
                    <div className="p-4">
                      <h1 className="text-xl font-bold uppercase line-clamp-1">
                        {title}
                      </h1>

                      <div className="flex flex-wrap items-center mt-4 text-lg gap-x-8">
                        {slide.averageScore && (
                          <TextIcon
                            LeftIcon={MdTagFaces}
                            iconClassName="text-green-300"
                          >
                            <p>{slide.averageScore}%</p>
                          </TextIcon>
                        )}
                        <TextIcon
                          LeftIcon={AiFillHeart}
                          iconClassName="text-red-400"
                        >
                          <p>{numberWithCommas(slide.favourites)}</p>
                        </TextIcon>
                        <DotList>
                          {slide.genres.map((genre) => (
                            <span key={genre}>
                              {convert(genre, "genre", { locale })}
                            </span>
                          ))}
                        </DotList>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            </Link>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );
};

const MobileHomeBannerSkeleton = () => (
  <Skeleton>
    <SkeletonItem className="aspect-w-16 aspect-h-9 rounded-md" />
  </Skeleton>
);

const DesktopHomeBanner: React.FC<HomeBannerProps> = ({ data, type }) => {
  const [index, setIndex] = useState<number>(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [player, setPlayer] =
    useState<ReturnType<YouTube["getInternalPlayer"]>>();
  const [isMuted, setIsMuted] = useState(true);
  const isRanOnce = useRef(false);
  const { locale } = useRouter();

  const activeSlide = useMemo(() => data[index], [data, index]);

  const handleSlideChange: SwiperProps["onSlideChange"] = useCallback(
    (swiper) => {
      setIndex(swiper.realIndex);
    },
    []
  );

  const getRedirectUrl = useCallback(
    (id: number) => {
      return type === MediaType.Anime
        ? `/anime/details/${id}`
        : `/manga/details/${id}`;
    },
    [type]
  );

  const mute = useCallback(() => {
    if (!player) return;

    player.mute();

    setIsMuted(true);
  }, [player]);

  const unMute = useCallback(() => {
    if (!player) return;

    player.unMute();

    setIsMuted(false);
  }, [player]);

  const title = useMemo(
    () => getTitle(activeSlide, locale),
    [activeSlide, locale]
  );
  const description = useMemo(
    () => getDescription(activeSlide, locale),
    [activeSlide, locale]
  );

  useEffect(() => {
    setShowTrailer(false);
  }, [activeSlide]);

  return (
    <React.Fragment>
      <div className="group relative w-full h-[450px] overflow-hidden">
        <AnimatePresence>
          {activeSlide.bannerImage && !showTrailer && (
            <motion.div
              variants={bannerVariants}
              animate="animate"
              exit="exit"
              initial="initial"
              className="w-full h-0"
              key={title}
            >
              <Image
                src={activeSlide.bannerImage}
                layout="fill"
                objectFit="cover"
                objectPosition="50% 35%"
                alt={title}
              />
            </motion.div>
          )}

          {type === MediaType.Anime &&
            activeSlide?.trailer &&
            activeSlide.trailer?.site === "youtube" && (
              <YouTube
                videoId={activeSlide.trailer.id}
                onReady={({ target }) => {
                  setPlayer(target);
                }}
                onPlay={({ target }) => {
                  setShowTrailer(true);

                  if (!isRanOnce.current) {
                    setIsMuted(true);
                  } else if (!isMuted) {
                    setIsMuted(false);

                    target.unMute();
                  }

                  isRanOnce.current = true;
                }}
                onEnd={() => {
                  setShowTrailer(false);
                }}
                onError={() => {
                  setShowTrailer(false);
                }}
                containerClassName={classNames(
                  "relative w-full overflow-hidden aspect-w-16 aspect-h-9 h-[300%] -top-[100%]",
                  !showTrailer && "hidden"
                )}
                className="absolute inset-0 w-full h-full"
                opts={{
                  playerVars: {
                    autoplay: 1,
                    modestbranding: 1,
                    controls: 0,
                    mute: 1,
                    origin: "https://kaguya.live",
                  },
                }}
              />
            )}
        </AnimatePresence>

        <div className="absolute inset-0 flex flex-col justify-center px-4 banner__overlay md:px-12"></div>

        <motion.div
          variants={bannerVariants}
          animate="animate"
          initial="initial"
          key={title}
          className="absolute left-12 top-1/2 -translate-y-1/2 w-full md:w-[45%]"
          transition={{ ease: transition, duration: 1 }}
        >
          <h1 className="text-2xl font-bold uppercase md:text-4xl line-clamp-2 sm:line-clamp-3 md:line-clamp-4">
            {title}
          </h1>

          <div className="flex flex-wrap items-center mt-4 text-lg gap-x-8">
            {activeSlide.averageScore && (
              <TextIcon LeftIcon={MdTagFaces} iconClassName="text-green-300">
                <p>{activeSlide.averageScore}%</p>
              </TextIcon>
            )}

            <TextIcon LeftIcon={AiFillHeart} iconClassName="text-red-400">
              <p>{numberWithCommas(activeSlide.favourites)}</p>
            </TextIcon>

            <DotList>
              {activeSlide.genres.map((genre) => (
                <span key={genre}>{convert(genre, "genre", { locale })}</span>
              ))}
            </DotList>
          </div>

          <Description
            description={description}
            className="hidden mt-2 text-base md:block text-gray-200 md:line-clamp-5"
          />
        </motion.div>

        <Link href={getRedirectUrl(activeSlide.id)}>
          <a>
            <CircleButton
              LeftIcon={AiFillPlayCircle}
              outline
              className="absolute hidden -translate-x-1/2 -translate-y-1/2 opacity-0 md:block left-2/3 top-1/2 group-hover:opacity-100"
              iconClassName="w-16 h-16"
            />
          </a>
        </Link>

        {showTrailer && player && (
          <CircleButton
            LeftIcon={isMuted ? BsFillVolumeMuteFill : BsFillVolumeUpFill}
            outline
            className="absolute bottom-20 right-12"
            iconClassName="w-6 h-6"
            onClick={isMuted ? unMute : mute}
          />
        )}

        <div className="absolute bottom-0 w-full h-16 banner__overlay--down"></div>
      </div>
      <div className="w-full px-4 pb-12 md:px-12">
        <BannerSwiper onSlideChange={handleSlideChange} data={data} />
      </div>
    </React.Fragment>
  );
};

const DesktopHomeBannerSkeleton = () => (
  <Skeleton className="w-full">
    <SkeletonItem className="relative h-[450px] w-full" container>
      <SkeletonItem
        className="absolute left-12 top-1/2 -translate-y-1/2 w-full md:w-[45%]"
        container
      >
        <SkeletonItem className="h-12 w-5/6" />

        <SkeletonItem className="mt-2 h-6 w-4/6" />

        <SkeletonItem className="mt-4 h-32 w-full" />
      </SkeletonItem>
    </SkeletonItem>
    <SkeletonItem className="h-[370px] w-full" container>
      <ListSwiperSkeleton hasTitle={false} />
    </SkeletonItem>
  </Skeleton>
);

export default React.memo(HomeBanner) as typeof HomeBanner;

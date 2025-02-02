import supabase from "@/lib/supabase";
import { getMedia } from "@/services/anilist";
import { Comment } from "@/types";
import { MediaType } from "@/types/anilist";
import { useSupabaseQuery } from "@/utils/supabase";
import { useQuery } from "react-query";

const mangaQuery = `
  *,
  user:user_id(*)
`;

const animeQuery = `
  *,
  user:user_id(*)
`;

const useNewestComments = (type: MediaType) => {
  const isAnime = type === MediaType.Anime;

  return useQuery(["newest-comments", type], async () => {
    const { data, error } = await supabase
      .from<Comment>("comments")
      .select(isAnime ? animeQuery : mangaQuery)
      .not(isAnime ? "anime_id" : "manga_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) throw error;

    const anilistMedia = await getMedia({
      id_in: data.map((comment) =>
        isAnime ? comment.anime_id : comment.manga_id
      ),
    });

    return data.map((comment) => {
      const media = anilistMedia.find(
        (media) => media.id === (isAnime ? comment.anime_id : comment.manga_id)
      );

      return {
        ...comment,
        media,
      };
    });
  });
};

export default useNewestComments;

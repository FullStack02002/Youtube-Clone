import { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Tweet } from "../models/tweet.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import mongoose, { Schema } from "mongoose";



//get Video Comments

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const commentsAggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const comments = await Comment.aggregatePaginate(commentsAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments fetched successfully"));
});

// add comment to a video

const createComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId) {
    throw new ApiError(400, "object id is not valid");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not Found");
  }

  if (!content) {
    throw new ApiError(400, "Content is Required");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user?._id,
  });

  if (!comment) {
    throw new ApiError(500, "Failed to Create a Comment");
  }

  return res
    .status(200)
    .json(new ApiResponse(201, comment, "Comment Added Succesfully"));
});
//delete comment
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(400, "Comment not Found");
  }

  if (comment?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "only owner of comment can delete this comment");
  }

  await Comment.findByIdAndDelete(commentId);

  await Like.deleteMany({
    comment: commentId,
    likedBy: req.user?._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { commentId }, "Comment Deleted Succesfully"));
});

//update comment

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not Found");
  }

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  if (comment.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "only comment owner can edit their comment");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!updatedComment) {
    throw new ApiError(500, "Error in Updating Comment Try Again");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updateComment, "Comment Updated Succesfully"));
});



export { createComment, deleteComment, updateComment, getVideoComments };

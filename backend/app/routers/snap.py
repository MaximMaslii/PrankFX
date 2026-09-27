import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse

from app.config import settings
from app.schemas.snap import (
    SnapCatalogOut,
    SnapJobListOut,
    SnapJobOut,
    SnapPhotoJobIn,
)
from app.security.dependencies import get_current_user
from app.services.snap_service import SnapService
from snap_effects import (
    SNAP_AT_SECONDS,
    SNAP_RETURN_HINT_SECONDS,
    SNAP_TOTAL_SECONDS,
)


logger = logging.getLogger("prankfx.snap.api")

router = APIRouter(
    prefix="/api/snap",
    tags=["Snap"],
)

snap_service = SnapService()


@router.get("/effects", response_model=SnapCatalogOut)
async def snap_effects():
    return SnapCatalogOut(
        effects=snap_service.catalog(),
        total_seconds=SNAP_TOTAL_SECONDS,
        snap_at_seconds=SNAP_AT_SECONDS,
        return_hint_seconds=SNAP_RETURN_HINT_SECONDS,
        fx_cost=settings.SNAP_FX_COST,
    )


@router.post(
    "/jobs",
    response_model=SnapJobOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_snap_job(
    background_tasks: BackgroundTasks,
    effect_id: str = Form(...),
    video: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    video_bytes = await video.read()

    try:
        job = await snap_service.create_job(
            user_id=current_user["user_id"],
            effect_id=effect_id,
            video_bytes=video_bytes,
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    background_tasks.add_task(snap_service.process_job, job["job_id"])

    return job


@router.post(
    "/photo-jobs",
    response_model=SnapJobOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_snap_photo_job(
    body: SnapPhotoJobIn,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Animate one photo with PixVerse. Same job/poll/result cycle as a
    recorded Snap — only the input differs."""
    try:
        job = await snap_service.create_photo_job(
            user_id=current_user["user_id"],
            effect_id=body.effect_id,
            image_base64=body.image_base64,
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    background_tasks.add_task(snap_service.process_job, job["job_id"])

    return job


@router.get("/jobs", response_model=SnapJobListOut)
async def list_snap_jobs(
    current_user: dict = Depends(get_current_user),
):
    return SnapJobListOut(
        items=await snap_service.list_jobs(current_user["user_id"]),
    )


@router.get("/jobs/{job_id}", response_model=SnapJobOut)
async def get_snap_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        return await snap_service.get_job(current_user["user_id"], job_id)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/jobs/{job_id}/video")
async def get_snap_video(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    """The finished clip.

    Authentication is the normal bearer header — the token never goes into the
    URL, so a shared link cannot leak a session.
    """
    try:
        path = await snap_service.result_path(current_user["user_id"], job_id)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return FileResponse(
        path,
        media_type="video/mp4",
        filename=f"prankfx_snap_{job_id}.mp4",
    )


@router.get("/jobs/{job_id}/poster")
async def get_snap_poster(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Thumbnail for the "My videos" row."""
    try:
        path = await snap_service.poster_path(current_user["user_id"], job_id)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return FileResponse(path, media_type="image/jpeg")


@router.delete("/jobs/{job_id}")
async def delete_snap_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        await snap_service.delete_job(current_user["user_id"], job_id)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return {"ok": True}

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .ai import analyze_food
import traceback

@csrf_exempt
@require_POST
def analyze_view(request):
    image = request.FILES.get("image")
    if image is None:
        return JsonResponse({"error": "No image uploaded. Use the 'image' field."}, status=400)
    if not image.content_type.startswith("image/"):
        return JsonResponse({"error": "File must be an image."}, status=400)
    try:
        result = analyze_food(image.read(), image.content_type)
    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"error": "AI analysis failed", "details": str(e)}, status=500)
    return JsonResponse(result)
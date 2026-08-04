from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACTS = Path(__file__).resolve().parent.parent / "test-artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    desktop = browser.new_page(viewport={"width": 1440, "height": 1000})
    page_errors: list[str] = []
    desktop.on("pageerror", lambda error: page_errors.append(str(error)))
    desktop.goto("http://127.0.0.1:5173")
    desktop.wait_for_load_state("networkidle")
    desktop.get_by_role("heading", name="الدخول إلى مساحة العمل").wait_for()
    desktop.screenshot(
        path=str(ARTIFACTS / "auth-desktop.png"),
        full_page=True,
    )

    desktop.get_by_role("button", name="حساب جديد").click()
    desktop.get_by_role("heading", name="طلب حساب محامٍ").wait_for()
    assert desktop.locator('input[name="lawyerIdDocument"]').count() == 0

    registration_requests: list[dict] = []

    def mock_registration(route):
        registration_requests.append(
            {
                "content_type": route.request.headers.get("content-type"),
                "payload": route.request.post_data_json,
            }
        )
        route.fulfill(
            status=201,
            content_type="application/json",
            body='{"message":"Registration succeeded.","user":{}}',
        )

    desktop.route("**/api/v1/auth/register", mock_registration)
    registration_form = desktop.locator("form.registration-grid")
    registration_form.locator('input[name="fullName"]').fill("Contract Lawyer")
    registration_form.locator('input[name="email"]').fill("contract@example.test")
    registration_form.locator('input[name="password"]').fill("ContractPass123")
    registration_form.locator('input[name="officeName"]').fill("Contract Office")
    registration_form.locator('select[name="teamSize"]').select_option("solo")
    registration_form.locator('input[name="barAssociationNumber"]').fill("BAR-1")
    registration_form.locator("button.primary-action").click()
    desktop.locator('form input[autocomplete="current-password"]').wait_for()

    assert registration_requests == [
        {
            "content_type": "application/json",
            "payload": {
                "fullName": "Contract Lawyer",
                "email": "contract@example.test",
                "password": "ContractPass123",
                "officeName": "Contract Office",
                "teamSize": "solo",
                "barAssociationNumber": "BAR-1",
            },
        }
    ]

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto("http://127.0.0.1:5173")
    mobile.wait_for_load_state("networkidle")
    mobile.get_by_role("heading", name="الدخول إلى مساحة العمل").wait_for()
    mobile.screenshot(
        path=str(ARTIFACTS / "auth-mobile.png"),
        full_page=True,
    )

    verification_calls = [0]
    verification = browser.new_page(viewport={"width": 1100, "height": 800})

    def mock_verification(route):
        if route.request.url.endswith("/auth/verify-email"):
            verification_calls[0] += 1
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"message":"Email verification succeeded."}',
            )
        else:
            route.continue_()

    verification.route("**/api/v1/**", mock_verification)
    verification.goto(
        f"http://127.0.0.1:5173/verify-email?token={'a' * 64}"
    )
    verification.get_by_role(
        "heading", name="تم تفعيل البريد الإلكتروني"
    ).wait_for()
    assert verification_calls[0] == 1
    verification.screenshot(
        path=str(ARTIFACTS / "email-verified.png"),
        full_page=True,
    )

    workspace = browser.new_page(viewport={"width": 1440, "height": 1000})

    def mock_api(route):
        url = route.request.url
        if url.endswith("/auth/refresh-token"):
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"access_token":"demo","user":{"id":"u1","fullName":"هدى منصور","email":"hoda@example.com","role":"lawyer","isEmailVerified":true}}',
            )
        elif "/conversations?" in url:
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"conversations":[{"conversation_id":"c1","title":"فصل العامل خلال فترة الاختبار","status":"active","message_count":2,"last_message_at":"2026-07-30T12:00:00.000Z"}],"next_cursor":null}',
            )
        elif url.endswith("/conversations/c1/messages?limit=50"):
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"messages":[{"message_id":"m1","conversation_id":"c1","role":"user","status":"completed","sequence":1,"content":"ما شروط فصل العامل خلال فترة الاختبار؟","created_at":"2026-07-30T12:00:00.000Z"},{"message_id":"m2","conversation_id":"c1","role":"assistant","status":"completed","sequence":2,"content":"تخضع الإجابة للنص المنشور وظروف كل حالة. [S1]","source_snapshot":[{"sourceId":"S1","chunkId":"ch1","authorityTitleOfficial":"قانون العمل المصري","authorityType":"statute","authorityStatus":"effective","articleNumber":"10","excerpt":"نص قانوني محفوظ كما استُخدم وقت إنشاء الإجابة."}],"created_at":"2026-07-30T12:00:02.000Z"}],"next_cursor":null}',
            )
        else:
            route.continue_()

    workspace.route("**/api/v1/**", mock_api)
    workspace.goto("http://127.0.0.1:5173")
    workspace.wait_for_load_state("networkidle")
    workspace.get_by_role(
        "heading", name="فصل العامل خلال فترة الاختبار"
    ).wait_for()
    workspace.screenshot(
        path=str(ARTIFACTS / "workspace-desktop.png"),
        full_page=True,
    )

    assert not page_errors, f"Browser page errors: {page_errors}"
    browser.close()

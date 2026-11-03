SECRET_KEY = "not-secret"
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "widget_tweaks",
    "blog",
]
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
    },
]

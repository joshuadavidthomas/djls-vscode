from django import template

register = template.Library()


@register.simple_tag
def recent_posts(count=5):
    return []

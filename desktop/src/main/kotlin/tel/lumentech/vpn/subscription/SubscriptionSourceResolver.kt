package tel.lumentech.vpn.subscription

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request

class SubscriptionSourceResolver(
    private val http: OkHttpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .callTimeout(45, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build(),
    private val fetchOverride: ((String) -> String)? = null,
    private val hwidProvider: (() -> String)? = null,
) {
    fun resolve(source: String, content: String): ResolvedSubscriptionSource {
        val normalized = unwrap(content.trim())
        AmneziaQrCodec.decodeNativeConfig(normalized.content)?.let { decoded ->
            return ResolvedSubscriptionSource(
                source = normalized.source,
                content = decoded,
                name = normalized.name ?: "Amnezia VPN",
            )
        }
        if (normalized.content.startsWith("happ://crypt", ignoreCase = true)) {
            error("Encrypted Happ QR is not decodable without Happ private client keys. Use the standard subscription URL.")
        }
        if (normalized.content.isRemoteHttpUrl()) {
            val url = normalized.content.stripFragment()
            val body = fetchSubscription(url)
            return ResolvedSubscriptionSource(
                source = url,
                content = body,
                name = normalized.name ?: normalized.content.fragmentName() ?: "Remote subscription",
            )
        }
        return ResolvedSubscriptionSource(
            source = source,
            content = normalized.content,
            name = normalized.name,
        )
    }

    internal fun unwrap(raw: String): ResolvedSubscriptionSource {
        var current = raw.trim().trim('\uFEFF')
        var name: String? = current.fragmentName()

        repeat(6) {
            LumenDeepLink.parse(current)?.let { payload ->
                name = name ?: payload.name
                if (payload.content != current) {
                    current = payload.content
                    return@repeat
                }
            }

            val uri = current.toUriOrNull() ?: return@repeat
            val fromQuery = uri.firstQueryValue("url", "uri", "link", "config", "sub", "subscription")
            if (!fromQuery.isNullOrBlank()) {
                name = name ?: uri.rawFragment?.urlDecode()
                current = fromQuery
                return@repeat
            }

            val fromPath = uri.knownPayloadPath()
            if (!fromPath.isNullOrBlank()) {
                name = name ?: uri.rawFragment?.urlDecode()
                current = fromPath
                return@repeat
            }
            return ResolvedSubscriptionSource("qr", current, name)
        }

        return ResolvedSubscriptionSource("qr", current, name)
    }

    private fun fetchSubscription(url: String): String {
        val uri = URI(url)
        require(uri.scheme.equals("https", ignoreCase = true)) {
            "Remote subscription URLs must use HTTPS."
        }
        val requestUrl = url.withHwid(hwidProvider?.invoke()?.trim().orEmpty())
        fetchOverride?.let { return it(requestUrl).trim() }
        val request = Request.Builder()
            .url(requestUrl)
            .header("Accept", "application/json,text/plain,*/*")
            .header("User-Agent", "HiddifyNext/2.5.7")
            .get()
            .build()
        http.newCall(request).execute().use { response ->
            require(response.isSuccessful) { "Subscription URL returned HTTP ${response.code}" }
            val body = response.body.string().trim()
            require(body.isNotBlank()) { "Subscription URL returned an empty body." }
            return body
        }
    }

    data class ResolvedSubscriptionSource(
        val source: String,
        val content: String,
        val name: String? = null,
    )
}

private fun String.isRemoteHttpUrl(): Boolean =
    startsWith("https://", ignoreCase = true) || startsWith("http://", ignoreCase = true)

private fun String.stripFragment(): String = substringBefore("#")

private fun String.fragmentName(): String? =
    substringAfter("#", "")
        .takeIf { it.isNotBlank() }
        ?.urlDecode()

private fun String.withHwid(hwid: String): String {
    if (hwid.isBlank()) return this
    val separator = if ("?" in this) "&" else "?"
    return "$this${separator}hwid=${hwid.urlEncode()}"
}

private fun String.urlDecode(): String =
    runCatching {
        URLDecoder.decode(replace("+", "%2B"), StandardCharsets.UTF_8.name())
    }.getOrDefault(this)

private fun String.urlEncode(): String =
    java.net.URLEncoder.encode(this, StandardCharsets.UTF_8.name())

private fun String.toUriOrNull(): URI? =
    runCatching { URI(this) }.getOrNull()

private fun URI.firstQueryValue(vararg names: String): String? {
    val query = rawQuery ?: return null
    val wanted = names.map { it.lowercase() }.toSet()
    return query.split("&")
        .asSequence()
        .mapNotNull { part ->
            val key = part.substringBefore("=", "").urlDecode().lowercase()
            val value = part.substringAfter("=", "")
            if (key in wanted && value.isNotBlank()) value.urlDecode() else null
        }
        .firstOrNull()
}

private fun URI.knownPayloadPath(): String? {
    val raw = rawSchemeSpecificPart ?: rawPath ?: return null
    val candidate = raw
        .substringAfter("//", raw)
        .substringAfter("/", raw)
        .substringBefore("?")
        .substringBefore("#")
    return candidate.urlDecode().takeIf { it.isRemoteHttpUrl() || it.startsWith("{") }
}

// ======================================================
// XXFem Circle API - V1
// Authentication + Membership + Feed + Posts + Comments
// ======================================================

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors = buildCorsHeaders(origin);

    // -----------------------------------------------
    // CORS preflight must be answered before any
    // Cloudflare Access identity validation runs.
    // -----------------------------------------------
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    const response = await handleRequest(request, env);

    return withCors(response, cors);
  }
};

async function handleRequest(request, env) {
    try {
      const url = new URL(request.url);

      // -----------------------------------------------
      // Validate Cloudflare Access identity first
      // -----------------------------------------------
      const identity = await validateAccessUser(request, env);

      if (!identity.ok) {
        return json(
          {
            success: false,
            error: identity.error
          },
          403
        );
      }

      const email = identity.email.toLowerCase();

      // =================================================
      // ACCOUNT
      // =================================================

      // GET /
      // GET /me
      if (
        request.method === "GET" &&
        (url.pathname === "/" || url.pathname === "/me")
      ) {
        return getMe(email, env);
      }

      // =================================================
      // APPLICATION / MEMBERSHIP
      // =================================================

      // POST /join
      if (
        request.method === "POST" &&
        url.pathname === "/join"
      ) {
        return joinCircle(request, email, env);
      }

      // =================================================
      // PRIVATE CIRCLE FEED
      // =================================================

      // GET /feed
      if (
        request.method === "GET" &&
        url.pathname === "/feed"
      ) {
        const member = await requireApprovedMember(
          email,
          env
        );

        if (!member.ok) {
          return json(
            {
              success: false,
              error: member.error,
              status: member.status
            },
            403
          );
        }

        return getFeed(member.member, env);
      }

      // =================================================
      // POSTS
      // =================================================

      // POST /posts
      if (
        request.method === "POST" &&
        url.pathname === "/posts"
      ) {
        const member = await requireApprovedMember(
          email,
          env
        );

        if (!member.ok) {
          return json(
            {
              success: false,
              error: member.error
            },
            403
          );
        }

        return createPost(
          request,
          member.member,
          env
        );
      }

      // DELETE /posts/123
      if (
        request.method === "DELETE" &&
        url.pathname.startsWith("/posts/")
      ) {
        const member = await requireApprovedMember(
          email,
          env
        );

        if (!member.ok) {
          return json(
            {
              success: false,
              error: member.error
            },
            403
          );
        }

        const id = Number(
          url.pathname.split("/")[2]
        );

        return deletePost(
          id,
          member.member,
          env
        );
      }

      // =================================================
      // COMMENTS
      // =================================================

      // POST /comments
      if (
        request.method === "POST" &&
        url.pathname === "/comments"
      ) {
        const member = await requireApprovedMember(
          email,
          env
        );

        if (!member.ok) {
          return json(
            {
              success: false,
              error: member.error
            },
            403
          );
        }

        return createComment(
          request,
          member.member,
          env
        );
      }

      // =================================================
      // ADMIN
      // =================================================

      // GET /admin/pending
      if (
        request.method === "GET" &&
        url.pathname === "/admin/pending"
      ) {
        const admin = await requireAdmin(
          email,
          env
        );

        if (!admin.ok) {
          return json(
            {
              success: false,
              error: admin.error
            },
            403
          );
        }

        return getPendingMembers(env);
      }

      // POST /admin/approve
      if (
        request.method === "POST" &&
        url.pathname === "/admin/approve"
      ) {
        const admin = await requireAdmin(
          email,
          env
        );

        if (!admin.ok) {
          return json(
            {
              success: false,
              error: admin.error
            },
            403
          );
        }

        return approveMember(
          request,
          env
        );
      }

      // POST /admin/reject
      if (
        request.method === "POST" &&
        url.pathname === "/admin/reject"
      ) {
        const admin = await requireAdmin(
          email,
          env
        );

        if (!admin.ok) {
          return json(
            {
              success: false,
              error: admin.error
            },
            403
          );
        }

        return rejectMember(
          request,
          env
        );
      }

      return json(
        {
          success: false,
          error: "Route not found."
        },
        404
      );
    } catch (error) {
      console.error(error);

      return json(
        {
          success: false,
          error: "Server error",
          details: error.message
        },
        500
      );
    }
}


// ======================================================
// MEMBER ACCOUNT
// ======================================================

async function getMe(email, env) {
  const member = await findMember(
    email,
    env
  );

  if (!member) {
    return json({
      success: true,
      authenticated: true,
      member: false,
      status: "not_registered",
      message:
        "You are signed in but have not applied to XXFem Circle."
    });
  }

  if (member.status === "pending") {
    return json({
      success: true,
      authenticated: true,
      member: true,
      status: "pending",
      profile: memberProfile(member),
      message:
        "Your XXFem Circle application is awaiting approval."
    });
  }

  if (member.status !== "approved") {
    return json({
      success: true,
      authenticated: true,
      member: true,
      status: member.status,
      profile: memberProfile(member),
      message:
        "Your XXFem Circle membership is not currently active."
    });
  }

  return json({
    success: true,
    authenticated: true,
    member: true,
    status: "approved",
    profile: memberProfile(member),
    message:
      `Welcome to XXFem Circle, ${member.display_name}.`
  });
}


// ======================================================
// JOIN CIRCLE
// ======================================================

async function joinCircle(
  request,
  email,
  env
) {
  const existing = await findMember(
    email,
    env
  );

  if (existing) {
    return json(
      {
        success: false,
        error:
          "A membership record already exists.",
        status: existing.status
      },
      409
    );
  }

  let data;

  try {
    data = await request.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "Invalid membership application."
      },
      400
    );
  }

  const displayName = clean(
    data.displayName
  );

  const state = clean(
    data.state
  );

  const bio = clean(
    data.bio
  );

  if (!displayName) {
    return json(
      {
        success: false,
        error:
          "Display name is required."
      },
      400
    );
  }

  if (displayName.length > 80) {
    return json(
      {
        success: false,
        error:
          "Display name must be 80 characters or less."
      },
      400
    );
  }

  if (state.length > 80) {
    return json(
      {
        success: false,
        error:
          "State is too long."
      },
      400
    );
  }

  if (bio.length > 1000) {
    return json(
      {
        success: false,
        error:
          "Bio must be 1,000 characters or less."
      },
      400
    );
  }

  await env.DB.prepare(`
    INSERT INTO members (
      email,
      display_name,
      state,
      bio,
      show_email,
      show_state,
      show_photo,
      status,
      role
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      1,
      1,
      1,
      'pending',
      'member'
    )
  `)
    .bind(
      email,
      displayName,
      state,
      bio
    )
    .run();

  return json(
    {
      success: true,
      status: "pending",
      message:
        "Your XXFem Circle application was submitted successfully."
    },
    201
  );
}


// ======================================================
// CIRCLE FEED
// ======================================================

async function getFeed(
  currentMember,
  env
) {
  const posts = await env.DB.prepare(`
    SELECT
      p.id,
      p.member_id,
      p.body,
      p.created_at,
      p.updated_at,

      m.display_name,
      m.state,
      m.photo_key,
      m.show_state,
      m.show_photo,
      m.role

    FROM circle_posts p

    JOIN members m
      ON m.id = p.member_id

    WHERE
      p.status = 'published'
      AND m.status = 'approved'

    ORDER BY
      p.created_at DESC

    LIMIT 100
  `).all();

  const results = [];

  for (
    const post of posts.results
  ) {
    const comments =
      await env.DB.prepare(`
        SELECT
          c.id,
          c.post_id,
          c.member_id,
          c.body,
          c.created_at,

          m.display_name,
          m.state,
          m.photo_key,
          m.show_state,
          m.show_photo,
          m.role

        FROM circle_comments c

        JOIN members m
          ON m.id = c.member_id

        WHERE
          c.post_id = ?
          AND c.status = 'published'
          AND m.status = 'approved'

        ORDER BY
          c.created_at ASC

        LIMIT 200
      `)
        .bind(post.id)
        .all();

    results.push({
      id: post.id,

      body: post.body,

      createdAt:
        post.created_at,

      updatedAt:
        post.updated_at,

      canDelete:
        currentMember.role === "admin" ||
        currentMember.id ===
          post.member_id,

      author: {
        id:
          post.member_id,

        displayName:
          post.display_name,

        state:
          post.show_state
            ? post.state
            : null,

        hasPhoto:
          Boolean(
            post.photo_key &&
            post.show_photo
          ),

        role:
          post.role
      },

      comments:
        comments.results.map(
          comment => ({
            id:
              comment.id,

            body:
              comment.body,

            createdAt:
              comment.created_at,

            author: {
              id:
                comment.member_id,

              displayName:
                comment.display_name,

              state:
                comment.show_state
                  ? comment.state
                  : null,

              hasPhoto:
                Boolean(
                  comment.photo_key &&
                  comment.show_photo
                ),

              role:
                comment.role
            }
          })
        )
    });
  }

  return json({
    success: true,

    member: {
      id:
        currentMember.id,

      displayName:
        currentMember.display_name,

      role:
        currentMember.role
    },

    posts:
      results
  });
}


// ======================================================
// CREATE POST
// ======================================================

async function createPost(
  request,
  member,
  env
) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "Invalid post submission."
      },
      400
    );
  }

  const body = clean(
    data.body
  );

  if (!body) {
    return json(
      {
        success: false,
        error:
          "Your post cannot be empty."
      },
      400
    );
  }

  if (body.length > 5000) {
    return json(
      {
        success: false,
        error:
          "Posts must be 5,000 characters or less."
      },
      400
    );
  }

  const result =
    await env.DB.prepare(`
      INSERT INTO circle_posts (
        member_id,
        body,
        status
      )
      VALUES (
        ?,
        ?,
        'published'
      )
    `)
      .bind(
        member.id,
        body
      )
      .run();

  return json(
    {
      success: true,

      postId:
        result.meta
          ?.last_row_id ||
        null,

      message:
        "Your post was published."
    },
    201
  );
}


// ======================================================
// DELETE POST
// ======================================================

async function deletePost(
  id,
  member,
  env
) {
  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return json(
      {
        success: false,
        error:
          "Invalid post ID."
      },
      400
    );
  }

  const post =
    await env.DB.prepare(`
      SELECT
        id,
        member_id,
        status

      FROM circle_posts

      WHERE id = ?

      LIMIT 1
    `)
      .bind(id)
      .first();

  if (!post) {
    return json(
      {
        success: false,
        error:
          "Post not found."
      },
      404
    );
  }

  const ownsPost =
    post.member_id === member.id;

  const isAdmin =
    member.role === "admin";

  if (
    !ownsPost &&
    !isAdmin
  ) {
    return json(
      {
        success: false,
        error:
          "You do not have permission to delete this post."
      },
      403
    );
  }

  await env.DB.prepare(`
    UPDATE circle_posts

    SET
      status = 'deleted'

    WHERE
      id = ?
  `)
    .bind(id)
    .run();

  await env.DB.prepare(`
    UPDATE circle_comments

    SET
      status = 'deleted'

    WHERE
      post_id = ?
  `)
    .bind(id)
    .run();

  return json({
    success: true,
    message:
      "Post deleted."
  });
}


// ======================================================
// CREATE COMMENT
// ======================================================

async function createComment(
  request,
  member,
  env
) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "Invalid comment submission."
      },
      400
    );
  }

  const postId = Number(
    data.postId
  );

  const body = clean(
    data.body
  );

  if (
    !Number.isInteger(postId) ||
    postId <= 0
  ) {
    return json(
      {
        success: false,
        error:
          "Invalid post ID."
      },
      400
    );
  }

  if (!body) {
    return json(
      {
        success: false,
        error:
          "Comment cannot be empty."
      },
      400
    );
  }

  if (body.length > 2000) {
    return json(
      {
        success: false,
        error:
          "Comments must be 2,000 characters or less."
      },
      400
    );
  }

  const post =
    await env.DB.prepare(`
      SELECT id

      FROM circle_posts

      WHERE
        id = ?
        AND status = 'published'

      LIMIT 1
    `)
      .bind(postId)
      .first();

  if (!post) {
    return json(
      {
        success: false,
        error:
          "Post not found."
      },
      404
    );
  }

  const result =
    await env.DB.prepare(`
      INSERT INTO circle_comments (
        post_id,
        member_id,
        body,
        status
      )
      VALUES (
        ?,
        ?,
        ?,
        'published'
      )
    `)
      .bind(
        postId,
        member.id,
        body
      )
      .run();

  return json(
    {
      success: true,

      commentId:
        result.meta
          ?.last_row_id ||
        null,

      message:
        "Comment published."
    },
    201
  );
}


// ======================================================
// MEMBER AUTHORIZATION
// ======================================================

async function requireApprovedMember(
  email,
  env
) {
  const member =
    await findMember(
      email,
      env
    );

  if (!member) {
    return {
      ok: false,

      status:
        "not_registered",

      error:
        "XXFem Circle membership is required."
    };
  }

  if (
    member.status !==
    "approved"
  ) {
    return {
      ok: false,

      status:
        member.status,

      error:
        "Your XXFem Circle membership is not currently approved."
    };
  }

  return {
    ok: true,
    member
  };
}


// ======================================================
// ADMIN AUTHORIZATION
// ======================================================

async function requireAdmin(
  email,
  env
) {
  const member =
    await findMember(
      email,
      env
    );

  if (!member) {
    return {
      ok: false,
      error:
        "Member account not found."
    };
  }

  if (
    member.status !==
      "approved" ||
    member.role !==
      "admin"
  ) {
    return {
      ok: false,
      error:
        "Administrator access required."
    };
  }

  return {
    ok: true,
    member
  };
}


// ======================================================
// ADMIN - PENDING APPLICATIONS
// ======================================================

async function getPendingMembers(
  env
) {
  const result =
    await env.DB.prepare(`
      SELECT
        id,
        email,
        display_name,
        state,
        bio,
        created_at

      FROM members

      WHERE
        status = 'pending'

      ORDER BY
        created_at ASC
    `).all();

  return json({
    success: true,

    applications:
      result.results
  });
}


// ======================================================
// ADMIN - APPROVE
// ======================================================

async function approveMember(
  request,
  env
) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "Invalid request."
      },
      400
    );
  }

  const id = Number(
    data.id
  );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return json(
      {
        success: false,
        error:
          "Valid member ID required."
      },
      400
    );
  }

  const result =
    await env.DB.prepare(`
      UPDATE members

      SET
        status = 'approved'

      WHERE
        id = ?
        AND status = 'pending'
    `)
      .bind(id)
      .run();

  if (
    !result.meta?.changes
  ) {
    return json(
      {
        success: false,
        error:
          "Pending member application was not found."
      },
      404
    );
  }

  return json({
    success: true,
    message:
      "Member approved."
  });
}


// ======================================================
// ADMIN - REJECT
// ======================================================

async function rejectMember(
  request,
  env
) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "Invalid request."
      },
      400
    );
  }

  const id = Number(
    data.id
  );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return json(
      {
        success: false,
        error:
          "Valid member ID required."
      },
      400
    );
  }

  const result =
    await env.DB.prepare(`
      UPDATE members

      SET
        status = 'rejected'

      WHERE
        id = ?
        AND status = 'pending'
    `)
      .bind(id)
      .run();

  if (
    !result.meta?.changes
  ) {
    return json(
      {
        success: false,
        error:
          "Pending member application was not found."
      },
      404
    );
  }

  return json({
    success: true,
    message:
      "Application rejected."
  });
}


// ======================================================
// DATABASE MEMBER LOOKUP
// ======================================================

async function findMember(
  email,
  env
) {
  return env.DB.prepare(`
    SELECT
      id,
      email,
      display_name,
      state,
      bio,
      photo_key,
      show_email,
      show_state,
      show_photo,
      status,
      role,
      created_at

    FROM members

    WHERE
      LOWER(email) = ?

    LIMIT 1
  `)
    .bind(
      email.toLowerCase()
    )
    .first();
}


// ======================================================
// MEMBER PROFILE RESPONSE
// ======================================================

function memberProfile(
  member
) {
  return {
    id:
      member.id,

    displayName:
      member.display_name,

    email:
      member.show_email
        ? member.email
        : null,

    state:
      member.show_state
        ? member.state
        : null,

    bio:
      member.bio ||
      "",

    hasPhoto:
      Boolean(
        member.photo_key &&
        member.show_photo
      ),

    role:
      member.role,

    joined:
      member.created_at
  };
}


// ======================================================
// CLOUDFLARE ACCESS JWT VALIDATION
// ======================================================

async function validateAccessUser(
  request,
  env
) {
  if (
    !env.TEAM_DOMAIN ||
    !env.POLICY_AUD
  ) {
    return {
      ok: false,

      error:
        "Worker authentication settings are missing."
    };
  }

  const token =
    request.headers.get(
      "cf-access-jwt-assertion"
    );

  if (!token) {
    return {
      ok: false,

      error:
        "Missing Cloudflare Access token."
    };
  }

  const parts =
    token.split(".");

  if (
    parts.length !== 3
  ) {
    return {
      ok: false,

      error:
        "Invalid Access token format."
    };
  }

  let header;
  let payload;

  try {
    header =
      JSON.parse(
        base64UrlDecode(
          parts[0]
        )
      );

    payload =
      JSON.parse(
        base64UrlDecode(
          parts[1]
        )
      );
  } catch {
    return {
      ok: false,

      error:
        "Unable to decode Access token."
    };
  }

  if (
    header.alg !==
    "RS256"
  ) {
    return {
      ok: false,

      error:
        "Unexpected token algorithm."
    };
  }

  if (!header.kid) {
    return {
      ok: false,

      error:
        "Access token is missing signing key ID."
    };
  }

  const teamDomain =
    env.TEAM_DOMAIN
      .replace(
        /\/$/,
        ""
      );

  const jwksResponse =
    await fetch(
      `${teamDomain}/cdn-cgi/access/certs`,
      {
        cf: {
          cacheTtl:
            3600,

          cacheEverything:
            true
        }
      }
    );

  if (
    !jwksResponse.ok
  ) {
    return {
      ok: false,

      error:
        "Unable to retrieve Access signing keys."
    };
  }

  const jwks =
    await jwksResponse.json();

  const jwk =
    jwks.keys?.find(
      key =>
        key.kid ===
        header.kid
    );

  if (!jwk) {
    return {
      ok: false,

      error:
        "Cloudflare signing key not found."
    };
  }

  const cryptoKey =
    await crypto.subtle.importKey(
      "jwk",

      jwk,

      {
        name:
          "RSASSA-PKCS1-v1_5",

        hash:
          "SHA-256"
      },

      false,

      [
        "verify"
      ]
    );

  const signedData =
    new TextEncoder()
      .encode(
        `${parts[0]}.${parts[1]}`
      );

  const signature =
    base64UrlToUint8Array(
      parts[2]
    );

  const valid =
    await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",

      cryptoKey,

      signature,

      signedData
    );

  if (!valid) {
    return {
      ok: false,

      error:
        "Invalid Access token signature."
    };
  }

  const now =
    Math.floor(
      Date.now() /
      1000
    );

  if (
    payload.exp &&
    payload.exp < now
  ) {
    return {
      ok: false,

      error:
        "Access token has expired."
    };
  }

  if (
    payload.nbf &&
    payload.nbf > now
  ) {
    return {
      ok: false,

      error:
        "Access token is not active yet."
    };
  }

  if (
    payload.iss !==
    teamDomain
  ) {
    return {
      ok: false,

      error:
        "Invalid Access token issuer."
    };
  }

  const audiences =
    Array.isArray(
      payload.aud
    )
      ? payload.aud
      : [
          payload.aud
        ];

  if (
    !audiences.includes(
      env.POLICY_AUD
    )
  ) {
    return {
      ok: false,

      error:
        "Access token is for the wrong application."
    };
  }

  if (
    !payload.email
  ) {
    return {
      ok: false,

      error:
        "Authenticated user email is missing."
    };
  }

  return {
    ok: true,

    email:
      payload.email,

    subject:
      payload.sub ||
      null
  };
}


// ======================================================
// CORS
// ======================================================

const ALLOWED_ORIGINS = [
  "https://cryptoqueen23.github.io",
  "https://xxfem.com",
  "https://www.xxfem.com"
];

function buildCorsHeaders(origin) {
  const headers = {
    "Vary": "Origin"
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }

  return headers;
}

function withCors(response, corsHeaders) {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}


// ======================================================
// HELPERS
// ======================================================

function clean(
  value
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return "";
  }

  return String(
    value
  ).trim();
}


function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff",

        "Referrer-Policy":
          "no-referrer",

        "X-Frame-Options":
          "DENY"
      }
    }
  );
}


function base64UrlDecode(
  value
) {
  const bytes =
    base64UrlToUint8Array(
      value
    );

  return new TextDecoder()
    .decode(
      bytes
    );
}


function base64UrlToUint8Array(
  value
) {
  let base64 =
    value
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  while (
    base64.length %
      4
  ) {
    base64 += "=";
  }

  const binary =
    atob(
      base64
    );

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i <
    binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(
        i
      );
  }

  return bytes;
}
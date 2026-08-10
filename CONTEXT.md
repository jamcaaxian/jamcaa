# jamcaa

A general-purpose publishing platform for content-driven websites. The core understands only generic publishing concepts; the shape of any particular site is determined by that site's own declarative configuration.

## Language

### Platform and sites

**Platform**:
The reusable publishing core. It knows only about collections, entries, media, users, and rules.
_Avoid_: framework, system, CMS

**Site**:
An independent website built on the platform, with its own content declaration, appearance, and domain.
_Avoid_: project, app, tenant, instance

### Content

**Collection**:
The structural definition of one kind of content, declaring which fields that content has.
_Avoid_: content type, model, post type

**Entry**:
One concrete piece of content belonging to a collection.
_Avoid_: record, document, row

**Field**:
A named data slot within a collection. It determines that data's storage shape, editing control, and validation rules alike.
_Avoid_: property, column, attribute

**Post**:
An entry published for readers, whose body is rich text. Markdown is an interchange format, not the body's stored form.
_Avoid_: article, gallery, item

**Taxonomy**:
The system by which entries are classified. A category is hierarchical and an entry belongs to exactly one; a tag is flat and an entry may carry many.
_Avoid_: tagging system, folder, channel

**Revision**:
A snapshot of an entry's content at a point in time, used for tracing and rollback.
_Avoid_: version, history

### Media and storage

**Media**:
A file under the platform's management, together with its metadata. Media always remembers which bucket holds it.
_Avoid_: attachment, asset, upload, file

**Bucket**:
A configured object storage target. It may be a bucket within the account, or any S3-compatible endpoint.
_Avoid_: storage, space, drive

**Storage Rule**:
A rule stating that uploads matching given conditions belong in a specified bucket. Rules are ordered by priority and the first match wins.
_Avoid_: policy, route, strategy

**Fallback Rule**:
The rule that applies when no storage rule matches. It always exists and cannot be deleted, though its target bucket can be changed.
_Avoid_: default rule, catch-all

**Upload Context**:
Every fact available for a rule to evaluate at the moment an upload happens — the owning collection, categories, tags, uploader, file type, and so on.
_Avoid_: upload params, metadata

### Users and engagement

**Role**:
A named set of capabilities. Users gain permissions by holding roles.

**Capability**:
The smallest permission unit that can be granted on its own, such as "publish another author's post".
_Avoid_: permission, grant

**Reaction**:
A reader's lightweight expression of interest in an entry, covering both bookmarking and liking.
_Avoid_: like, favourite, vote

**Moderation**:
The human clearance a comment must pass before it becomes visible to the public.
_Avoid_: review, approval, screening

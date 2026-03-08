# Copilot Instructions – LastMile Backend

## Project Overview

LastMile is a humanitarian logistics platform designed to coordinate aid during natural disasters in Colombia.

The platform connects **organizers, donors, and volunteers** to coordinate:

* disaster events
* donation campaigns
* resource collection
* logistics operations
* volunteer assignments
* communication between participants

The system will be consumed by a mobile application built with **Expo / React Native**.

The backend provides a REST API and WebSocket services.

---

# Tech Stack

Backend Framework

* NestJS
* Node.js
* TypeScript

Database

* PostgreSQL

ORM

* TypeORM

Other technologies

* WebSockets (for chat)
* REST API
* class-validator for validation
* Docker (optional)

---

# Architecture

The backend follows **modular architecture using NestJS modules**.

Each module contains:

* Controller (API endpoints)
* Service (business logic)
* Entity (database model)
* DTOs (data validation)

Project structure:

```id="scaffold1"
src/
 ├── modules/
 │
 │   ├── auth/
 │   ├── users/
 │   ├── events/
 │   ├── campaigns/
 │   ├── donations/
 │   ├── logistics/
 │   └── chat/
 │
 ├── common/
 │   ├── guards/
 │   ├── decorators/
 │   ├── filters/
 │   └── interceptors/
 │
 ├── config/
 │
 ├── app.module.ts
 └── main.ts
```

---

# User Roles

The system currently supports two main roles:

Organizer
Volunteer

Users can also participate as **donors** when contributing to campaigns.

---

# Core Modules

## Events Module

Represents natural disaster events in Colombian cities.

Organizers create events describing disasters.

Example events:

* Flood in Medellín
* Landslide in Manizales
* Earthquake in Cali

Responsibilities:

* create event
* list events
* update events
* view event details

---

## Campaigns Module

Campaigns belong to an event.

Each campaign represents a fundraising or resource collection effort.

Example:

Event: Flood in Medellín

Campaigns:

* Food donations
* Clothes donations
* Financial aid

Responsibilities:

* create campaign
* list campaigns by event
* track progress
* show collected donations

Each campaign also contains a **general chat**.

---

## Donations Module

Handles both types of donations:

* monetary donations
* physical items

Responsibilities:

* register donations
* update campaign totals
* track donation status

---

## Logistics Module

Manages physical operations for delivering resources.

Responsibilities:

* create pickup points
* assign shipments
* assign volunteers
* track delivery status

---

## Chat Module

Each campaign has a general chat.

Chat is implemented with **WebSockets**.

Users can send and receive messages related to the campaign.

---

# Data Model

The following entities represent the core data model.

---

## User

Represents all platform users.

Fields:

```id="user_fields"
id
name
email
password
role
createdAt
```

Role values:

```id="user_roles"
organizer
volunteer
donor
```

Relationships:

* organizer creates events
* donors donate to campaigns
* volunteers receive shipment assignments

---

## Event

Represents a disaster event.

Fields:

```id="event_fields"
id
name
disasterType
city
description
date
createdBy
createdAt
```

Relationships:

* event has many campaigns

---

## Campaign

Represents a donation initiative for a specific event.

Fields:

```id="campaign_fields"
id
name
description
campaignType
goalMoney
collectedMoney
eventId
createdBy
createdAt
```

Campaign types:

```id="campaign_types"
money
physical_items
mixed
```

Relationships:

* campaign belongs to event
* campaign has many donations
* campaign has many messages

---

## DonationMoney

Represents monetary donations.

Fields:

```id="donation_money_fields"
id
campaignId
donorId
amount
createdAt
```

Relationships:

* belongs to campaign
* belongs to user

---

## DonationItem

Represents physical donations.

Fields:

```id="donation_item_fields"
id
campaignId
donorId
itemName
quantity
status
createdAt
```

Status values:

```id="donation_item_status"
pending
delivered_to_pickup_point
assigned_to_shipment
delivered
```

---

## PickupPoint

Represents locations where donors deliver physical items.

Fields:

```id="pickup_fields"
id
name
city
address
latitude
longitude
createdAt
```

Relationships:

* pickup point receives donations
* pickup point is used in shipments

---

## Shipment

Represents delivery operations.

Fields:

```id="shipment_fields"
id
campaignId
pickupPointId
assignedVolunteerId
status
createdAt
```

Shipment status:

```id="shipment_status"
pending
assigned
in_transit
delivered
```

Relationships:

* shipment belongs to campaign
* shipment assigned to volunteer
* shipment linked to pickup point

---

## Message

Represents chat messages inside a campaign.

Fields:

```id="message_fields"
id
campaignId
userId
message
createdAt
```

Relationships:

* message belongs to campaign
* message belongs to user

---

# Entity Relationships

High level relationships:

```id="relationships"
User
 ├── creates → Events
 ├── donates → Campaigns
 └── volunteers → Shipments

Event
 └── has many → Campaigns

Campaign
 ├── has many → Donations
 ├── has many → Messages
 └── has many → Shipments

PickupPoint
 └── used in → Shipments
```

---

# API Design

Endpoints should follow REST conventions.

Examples:

Events

```id="api_events"
POST /events
GET /events
GET /events/:id
```

Campaigns

```id="api_campaigns"
POST /campaigns
GET /campaigns/event/:eventId
```

Donations

```id="api_donations"
POST /donations/money
POST /donations/items
```

Logistics

```id="api_logistics"
POST /pickup-points
POST /shipments
PATCH /shipments/:id/status
```

Chat

```id="api_chat"
WS /campaigns/:campaignId/chat
```

---

# Coding Guidelines

Copilot should generate code following these guidelines:

* Use NestJS decorators
* Keep controllers thin
* Business logic must be inside services
* Use DTOs for validation
* Use TypeORM repositories
* Follow clean modular design

Naming conventions:

Classes → PascalCase
Variables → camelCase
Files → kebab-case

Examples:

```id="naming_examples"
create-event.dto.ts
event.entity.ts
events.service.ts
```

---

# Goal

The backend should support the coordination of humanitarian operations by providing APIs for:

* disaster event management
* campaign coordination
* donation tracking
* logistics operations
* volunteer assignment
* real-time communication

Event-Driven Architecture

The backend uses modular architecture with event-driven communication.

Modules should not directly call services from other modules when possible.
Instead, they should communicate through domain events.

This improves:

scalability

modularity

maintainability

loose coupling between modules

The event system can be implemented using the NestJS EventEmitter module.

Example dependency:

@nestjs/event-emitter
Event Flow Example

Example flow when a donation is created:

User makes donation
       ↓
Donations Module
       ↓
Emit event: donation.created
       ↓
Campaigns Module listens
       ↓
Update campaign totals
       ↓
Logistics Module listens
       ↓
Check if shipment should be created
Example Events

Events should follow the naming convention:

domain.action

Examples:

event.created
campaign.created
donation.created
donation.item.received
shipment.assigned
shipment.delivered
message.sent
Example Event Implementation

Example event emission:

this.eventEmitter.emit('donation.created', {
  campaignId,
  donorId,
  amount,
});

Example event listener:

@OnEvent('donation.created')
handleDonationCreated(payload: DonationCreatedEvent) {
  // update campaign progress
}
Event-Driven Module Interaction

Modules should interact through events whenever possible.

Example:

Donations Module
   ↓ emit event
Campaign Module
   ↓ update totals
Logistics Module
   ↓ create shipment if needed
Notification Module
   ↓ notify users
Event Folder Structure
src/
 ├── events/
 │   ├── donation-created.event.ts
 │   ├── campaign-created.event.ts
 │   └── shipment-assigned.event.ts
When to Use Events

Copilot should generate events for actions such as:

campaign created

donation created

physical item delivered

shipment assigned

shipment delivered

chat message sent
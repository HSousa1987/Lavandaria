--
-- PostgreSQL database dump
--

\restrict cp7IVSEHCqujWJeiLDpU2ADVEm1pm29r6yr4oSS7Sh9sTKJFzyumHkrh9gZhv07

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: calculate_cleaning_job_cost(); Type: FUNCTION; Schema: public; Owner: lavandaria
--

CREATE FUNCTION public.calculate_cleaning_job_cost() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.actual_end_time IS NOT NULL AND NEW.actual_start_time IS NOT NULL THEN
        NEW.total_duration_minutes = EXTRACT(EPOCH FROM (NEW.actual_end_time - NEW.actual_start_time)) / 60;
        NEW.total_cost = (NEW.total_duration_minutes / 60.0) * NEW.hourly_rate;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_cleaning_job_cost() OWNER TO lavandaria;

--
-- Name: calculate_laundry_total(); Type: FUNCTION; Schema: public; Owner: lavandaria
--

CREATE FUNCTION public.calculate_laundry_total() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.order_type = 'bulk_kg' AND NEW.total_weight_kg IS NOT NULL THEN
        NEW.base_price = NEW.total_weight_kg * NEW.price_per_kg;
    END IF;
    NEW.total_price = NEW.base_price + COALESCE(NEW.additional_charges, 0) - COALESCE(NEW.discount, 0);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_laundry_total() OWNER TO lavandaria;

--
-- Name: calculate_payment_tax(); Type: FUNCTION; Schema: public; Owner: lavandaria
--

CREATE FUNCTION public.calculate_payment_tax() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.amount_before_tax = NEW.amount / (1 + (NEW.tax_percentage / 100));
    NEW.tax_amount = NEW.amount - NEW.amount_before_tax;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_payment_tax() OWNER TO lavandaria;

--
-- Name: update_cleaning_jobs_updated_at(); Type: FUNCTION; Schema: public; Owner: lavandaria
--

CREATE FUNCTION public.update_cleaning_jobs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_cleaning_jobs_updated_at() OWNER TO lavandaria;

--
-- Name: update_laundry_orders_updated_at(); Type: FUNCTION; Schema: public; Owner: lavandaria
--

CREATE FUNCTION public.update_laundry_orders_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_laundry_orders_updated_at() OWNER TO lavandaria;

--
-- Name: update_properties_updated_at(); Type: FUNCTION; Schema: public; Owner: lavandaria
--

CREATE FUNCTION public.update_properties_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_properties_updated_at() OWNER TO lavandaria;

--
-- Name: update_users_updated_at(); Type: FUNCTION; Schema: public; Owner: lavandaria
--

CREATE FUNCTION public.update_users_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_users_updated_at() OWNER TO lavandaria;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cleaning_job_photos; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.cleaning_job_photos (
    id integer NOT NULL,
    cleaning_job_id integer NOT NULL,
    worker_id integer NOT NULL,
    photo_url character varying(500) NOT NULL,
    photo_type character varying(20) NOT NULL,
    room_area character varying(100),
    thumbnail_url character varying(500),
    file_size_kb integer,
    original_filename character varying(255),
    caption text,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    viewed_by_client boolean DEFAULT false,
    viewed_at timestamp without time zone,
    CONSTRAINT cleaning_job_photos_photo_type_check CHECK (((photo_type)::text = ANY ((ARRAY['before'::character varying, 'after'::character varying, 'detail'::character varying])::text[])))
);


ALTER TABLE public.cleaning_job_photos OWNER TO lavandaria;

--
-- Name: TABLE cleaning_job_photos; Type: COMMENT; Schema: public; Owner: lavandaria
--

COMMENT ON TABLE public.cleaning_job_photos IS 'Before/after photos for client viewing';


--
-- Name: cleaning_job_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.cleaning_job_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cleaning_job_photos_id_seq OWNER TO lavandaria;

--
-- Name: cleaning_job_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.cleaning_job_photos_id_seq OWNED BY public.cleaning_job_photos.id;


--
-- Name: cleaning_job_workers; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.cleaning_job_workers (
    id integer NOT NULL,
    cleaning_job_id integer NOT NULL,
    worker_id integer NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_primary boolean DEFAULT false
);


ALTER TABLE public.cleaning_job_workers OWNER TO lavandaria;

--
-- Name: cleaning_job_workers_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.cleaning_job_workers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cleaning_job_workers_id_seq OWNER TO lavandaria;

--
-- Name: cleaning_job_workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.cleaning_job_workers_id_seq OWNED BY public.cleaning_job_workers.id;


--
-- Name: cleaning_jobs; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.cleaning_jobs (
    id integer NOT NULL,
    client_id integer NOT NULL,
    assigned_worker_id integer,
    job_type character varying(20) NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time time without time zone NOT NULL,
    estimated_hours numeric(5,2),
    actual_start_time timestamp without time zone,
    actual_end_time timestamp without time zone,
    total_duration_minutes integer,
    hourly_rate numeric(10,2) DEFAULT 15.00,
    total_cost numeric(10,2),
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    notes text,
    special_instructions text,
    client_feedback text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    client_viewed_photos boolean DEFAULT false,
    property_id integer NOT NULL,
    CONSTRAINT cleaning_jobs_job_type_check CHECK (((job_type)::text = ANY ((ARRAY['airbnb'::character varying, 'house'::character varying])::text[]))),
    CONSTRAINT cleaning_jobs_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'partial'::character varying])::text[]))),
    CONSTRAINT cleaning_jobs_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.cleaning_jobs OWNER TO lavandaria;

--
-- Name: TABLE cleaning_jobs; Type: COMMENT; Schema: public; Owner: lavandaria
--

COMMENT ON TABLE public.cleaning_jobs IS 'Airbnb and house cleaning jobs with time tracking';


--
-- Name: cleaning_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.cleaning_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cleaning_jobs_id_seq OWNER TO lavandaria;

--
-- Name: cleaning_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.cleaning_jobs_id_seq OWNED BY public.cleaning_jobs.id;


--
-- Name: cleaning_time_logs; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.cleaning_time_logs (
    id integer NOT NULL,
    cleaning_job_id integer NOT NULL,
    worker_id integer NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration_minutes integer,
    start_latitude numeric(10,8),
    start_longitude numeric(11,8),
    end_latitude numeric(10,8),
    end_longitude numeric(11,8),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cleaning_time_logs OWNER TO lavandaria;

--
-- Name: TABLE cleaning_time_logs; Type: COMMENT; Schema: public; Owner: lavandaria
--

COMMENT ON TABLE public.cleaning_time_logs IS 'Time tracking logs for billing accuracy';


--
-- Name: cleaning_time_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.cleaning_time_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cleaning_time_logs_id_seq OWNER TO lavandaria;

--
-- Name: cleaning_time_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.cleaning_time_logs_id_seq OWNED BY public.cleaning_time_logs.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    phone character varying(20) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(100),
    date_of_birth date,
    nif character varying(20),
    notes text,
    is_enterprise boolean DEFAULT false,
    company_name character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    must_change_password boolean DEFAULT true,
    name character varying(100) NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);


ALTER TABLE public.clients OWNER TO lavandaria;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO lavandaria;

--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: job_notifications; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.job_notifications (
    id integer NOT NULL,
    user_id integer,
    client_id integer,
    notification_type character varying(50) NOT NULL,
    cleaning_job_id integer,
    laundry_order_id integer,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    delivery_method character varying(20),
    sent_at timestamp without time zone,
    delivered_at timestamp without time zone,
    read_at timestamp without time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    push_token text,
    deep_link character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT job_notifications_delivery_method_check CHECK (((delivery_method)::text = ANY ((ARRAY['push'::character varying, 'sms'::character varying, 'email'::character varying, 'in_app'::character varying])::text[]))),
    CONSTRAINT job_notifications_notification_type_check CHECK (((notification_type)::text = ANY ((ARRAY['job_assigned'::character varying, 'job_started'::character varying, 'job_completed'::character varying, 'laundry_ready'::character varying, 'laundry_collected'::character varying, 'payment_received'::character varying, 'photo_uploaded'::character varying, 'feedback_requested'::character varying])::text[]))),
    CONSTRAINT job_notifications_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'delivered'::character varying, 'read'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.job_notifications OWNER TO lavandaria;

--
-- Name: TABLE job_notifications; Type: COMMENT; Schema: public; Owner: lavandaria
--

COMMENT ON TABLE public.job_notifications IS 'Notification system for mobile apps and SMS/email';


--
-- Name: job_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.job_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_notifications_id_seq OWNER TO lavandaria;

--
-- Name: job_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.job_notifications_id_seq OWNED BY public.job_notifications.id;


--
-- Name: laundry_order_items; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.laundry_order_items (
    id integer NOT NULL,
    laundry_order_id integer NOT NULL,
    item_type character varying(100) NOT NULL,
    item_category character varying(50),
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    condition_notes text,
    special_treatment character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT laundry_order_items_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'washing'::character varying, 'drying'::character varying, 'ironing'::character varying, 'ready'::character varying])::text[])))
);


ALTER TABLE public.laundry_order_items OWNER TO lavandaria;

--
-- Name: TABLE laundry_order_items; Type: COMMENT; Schema: public; Owner: lavandaria
--

COMMENT ON TABLE public.laundry_order_items IS 'Individual items in laundry orders';


--
-- Name: laundry_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.laundry_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.laundry_order_items_id_seq OWNER TO lavandaria;

--
-- Name: laundry_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.laundry_order_items_id_seq OWNED BY public.laundry_order_items.id;


--
-- Name: laundry_orders_new; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.laundry_orders_new (
    id integer NOT NULL,
    client_id integer NOT NULL,
    assigned_worker_id integer,
    order_number character varying(50) NOT NULL,
    order_type character varying(20) NOT NULL,
    total_weight_kg numeric(10,2),
    price_per_kg numeric(10,2) DEFAULT 3.50,
    base_price numeric(10,2),
    additional_charges numeric(10,2) DEFAULT 0,
    discount numeric(10,2) DEFAULT 0,
    total_price numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'received'::character varying NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    paid_amount numeric(10,2) DEFAULT 0,
    received_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ready_at timestamp without time zone,
    collected_at timestamp without time zone,
    expected_ready_date date,
    ready_notification_sent boolean DEFAULT false,
    ready_notification_sent_at timestamp without time zone,
    client_notified_via character varying(50),
    special_instructions text,
    internal_notes text,
    client_feedback text,
    client_rating integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    push_notification_sent boolean DEFAULT false,
    last_synced_at timestamp without time zone,
    CONSTRAINT laundry_orders_new_client_rating_check CHECK (((client_rating >= 1) AND (client_rating <= 5))),
    CONSTRAINT laundry_orders_new_order_type_check CHECK (((order_type)::text = ANY ((ARRAY['bulk_kg'::character varying, 'itemized'::character varying, 'house_bundle'::character varying])::text[]))),
    CONSTRAINT laundry_orders_new_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'partial'::character varying])::text[]))),
    CONSTRAINT laundry_orders_new_status_check CHECK (((status)::text = ANY ((ARRAY['received'::character varying, 'in_progress'::character varying, 'ready'::character varying, 'collected'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.laundry_orders_new OWNER TO lavandaria;

--
-- Name: TABLE laundry_orders_new; Type: COMMENT; Schema: public; Owner: lavandaria
--

COMMENT ON TABLE public.laundry_orders_new IS 'Laundry orders supporting bulk, itemized, and house bundles';


--
-- Name: laundry_orders_new_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.laundry_orders_new_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.laundry_orders_new_id_seq OWNER TO lavandaria;

--
-- Name: laundry_orders_new_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.laundry_orders_new_id_seq OWNED BY public.laundry_orders_new.id;


--
-- Name: laundry_services; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.laundry_services (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    service_type character varying(20) NOT NULL,
    base_price numeric(10,2) NOT NULL,
    unit character varying(20) DEFAULT 'item'::character varying,
    estimated_duration_minutes integer,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT laundry_services_service_type_check CHECK (((service_type)::text = ANY ((ARRAY['wash'::character varying, 'dry_clean'::character varying, 'iron'::character varying, 'special'::character varying])::text[])))
);


ALTER TABLE public.laundry_services OWNER TO lavandaria;

--
-- Name: laundry_services_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.laundry_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.laundry_services_id_seq OWNER TO lavandaria;

--
-- Name: laundry_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.laundry_services_id_seq OWNED BY public.laundry_services.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    client_id integer NOT NULL,
    service_type character varying(20) NOT NULL,
    cleaning_job_id integer,
    laundry_order_id integer,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(20) NOT NULL,
    payment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tax_percentage numeric(5,2) DEFAULT 23.00 NOT NULL,
    tax_amount numeric(10,2) DEFAULT 0 NOT NULL,
    amount_before_tax numeric(10,2) DEFAULT 0 NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_single_service CHECK (((((service_type)::text = 'cleaning'::text) AND (cleaning_job_id IS NOT NULL) AND (laundry_order_id IS NULL)) OR (((service_type)::text = 'laundry'::text) AND (laundry_order_id IS NOT NULL) AND (cleaning_job_id IS NULL)))),
    CONSTRAINT payments_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'transfer'::character varying, 'mbway'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT payments_service_type_check CHECK (((service_type)::text = ANY ((ARRAY['cleaning'::character varying, 'laundry'::character varying])::text[])))
);


ALTER TABLE public.payments OWNER TO lavandaria;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO lavandaria;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: properties; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.properties (
    id integer NOT NULL,
    client_id integer NOT NULL,
    property_name character varying(200),
    address_line1 character varying(200) NOT NULL,
    address_line2 character varying(200),
    city character varying(100) NOT NULL,
    postal_code character varying(20),
    district character varying(100),
    access_instructions text,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    property_type_id integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.properties OWNER TO lavandaria;

--
-- Name: properties_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.properties_id_seq OWNER TO lavandaria;

--
-- Name: properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.properties_id_seq OWNED BY public.properties.id;


--
-- Name: property_types; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.property_types (
    id integer NOT NULL,
    type_name character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.property_types OWNER TO lavandaria;

--
-- Name: property_types_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.property_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.property_types_id_seq OWNER TO lavandaria;

--
-- Name: property_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.property_types_id_seq OWNED BY public.property_types.id;


--
-- Name: role_types; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.role_types (
    id integer NOT NULL,
    role_name character varying(20) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT role_types_role_name_check CHECK (((role_name)::text = ANY ((ARRAY['master'::character varying, 'admin'::character varying, 'worker'::character varying])::text[])))
);


ALTER TABLE public.role_types OWNER TO lavandaria;

--
-- Name: role_types_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.role_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_types_id_seq OWNER TO lavandaria;

--
-- Name: role_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.role_types_id_seq OWNED BY public.role_types.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO lavandaria;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    service_type character varying(20),
    order_id integer,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(20) DEFAULT 'open'::character varying,
    created_by integer NOT NULL,
    assigned_to integer,
    resolved_at timestamp without time zone,
    resolved_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tickets_order_type_check CHECK (((service_type)::text = ANY ((ARRAY['laundry'::character varying, 'cleaning'::character varying, 'general'::character varying])::text[]))),
    CONSTRAINT tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT tickets_service_type_check CHECK (((service_type)::text = ANY ((ARRAY['laundry'::character varying, 'cleaning'::character varying, 'general'::character varying])::text[]))),
    CONSTRAINT tickets_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[])))
);


ALTER TABLE public.tickets OWNER TO lavandaria;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO lavandaria;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(100),
    phone character varying(20),
    date_of_birth date,
    nif character varying(20),
    address_line1 character varying(200),
    address_line2 character varying(200),
    city character varying(100),
    postal_code character varying(20),
    district character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    created_by integer,
    name character varying(100) NOT NULL,
    role_id integer NOT NULL
);


ALTER TABLE public.users OWNER TO lavandaria;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO lavandaria;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: cleaning_job_photos id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_photos ALTER COLUMN id SET DEFAULT nextval('public.cleaning_job_photos_id_seq'::regclass);


--
-- Name: cleaning_job_workers id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_workers ALTER COLUMN id SET DEFAULT nextval('public.cleaning_job_workers_id_seq'::regclass);


--
-- Name: cleaning_jobs id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_jobs ALTER COLUMN id SET DEFAULT nextval('public.cleaning_jobs_id_seq'::regclass);


--
-- Name: cleaning_time_logs id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_time_logs ALTER COLUMN id SET DEFAULT nextval('public.cleaning_time_logs_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: job_notifications id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.job_notifications ALTER COLUMN id SET DEFAULT nextval('public.job_notifications_id_seq'::regclass);


--
-- Name: laundry_order_items id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_order_items ALTER COLUMN id SET DEFAULT nextval('public.laundry_order_items_id_seq'::regclass);


--
-- Name: laundry_orders_new id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_orders_new ALTER COLUMN id SET DEFAULT nextval('public.laundry_orders_new_id_seq'::regclass);


--
-- Name: laundry_services id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_services ALTER COLUMN id SET DEFAULT nextval('public.laundry_services_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: properties id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.properties ALTER COLUMN id SET DEFAULT nextval('public.properties_id_seq'::regclass);


--
-- Name: property_types id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.property_types ALTER COLUMN id SET DEFAULT nextval('public.property_types_id_seq'::regclass);


--
-- Name: role_types id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.role_types ALTER COLUMN id SET DEFAULT nextval('public.role_types_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: cleaning_job_photos; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.cleaning_job_photos (id, cleaning_job_id, worker_id, photo_url, photo_type, room_area, thumbnail_url, file_size_kb, original_filename, caption, uploaded_at, viewed_by_client, viewed_at) FROM stdin;
\.


--
-- Data for Name: cleaning_job_workers; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.cleaning_job_workers (id, cleaning_job_id, worker_id, assigned_at, is_primary) FROM stdin;
1	2	3	2025-11-09 11:05:54.829336	t
\.


--
-- Data for Name: cleaning_jobs; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.cleaning_jobs (id, client_id, assigned_worker_id, job_type, scheduled_date, scheduled_time, estimated_hours, actual_start_time, actual_end_time, total_duration_minutes, hourly_rate, total_cost, status, payment_status, notes, special_instructions, client_feedback, created_by, created_at, updated_at, completed_at, client_viewed_photos, property_id) FROM stdin;
1	1	\N	airbnb	2025-11-11	10:00:00	\N	\N	\N	\N	15.00	\N	scheduled	pending	\N	\N	\N	1	2025-11-09 10:51:00.406956	2025-11-09 20:09:56.406576	\N	f	1
2	1	3	airbnb	2025-11-10	10:00:00	2.00	\N	\N	\N	15.00	\N	scheduled	pending	\N	\N	\N	2	2025-11-09 11:05:54.823438	2025-11-09 20:09:56.406576	\N	f	2
\.


--
-- Data for Name: cleaning_time_logs; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.cleaning_time_logs (id, cleaning_job_id, worker_id, start_time, end_time, duration_minutes, start_latitude, start_longitude, end_latitude, end_longitude, notes, created_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.clients (id, phone, password, email, date_of_birth, nif, notes, is_enterprise, company_name, created_at, is_active, must_change_password, name, updated_at, created_by) FROM stdin;
1	911111111	$2b$10$XYjLzqW8K9H.eN6D9h3.8OZN.q7K6r3zv3fV3d7N.H8K9XYjLzqW8K	joao@example.com	\N	\N	Sample client for testing	f	\N	2025-11-09 10:51:00.403183	t	t	João Santos	2025-11-09 20:09:56.406576	\N
\.


--
-- Data for Name: job_notifications; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.job_notifications (id, user_id, client_id, notification_type, cleaning_job_id, laundry_order_id, title, message, delivery_method, sent_at, delivered_at, read_at, status, push_token, deep_link, created_at) FROM stdin;
1	\N	1	laundry_ready	\N	1	Laundry Ready! 🧺	Your laundry order LDR-20251109-001 is ready to collect!	in_app	2025-11-09 12:30:51.193331	\N	\N	sent	\N	\N	2025-11-09 12:30:51.193331
2	\N	1	laundry_ready	\N	2	Laundry Ready! 🧺	Your laundry order LDR-20251109-002 is ready to collect!	in_app	2025-11-09 12:30:59.418825	\N	\N	sent	\N	\N	2025-11-09 12:30:59.418825
\.


--
-- Data for Name: laundry_order_items; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.laundry_order_items (id, laundry_order_id, item_type, item_category, quantity, unit_price, total_price, condition_notes, special_treatment, status, created_at) FROM stdin;
\.


--
-- Data for Name: laundry_orders_new; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.laundry_orders_new (id, client_id, assigned_worker_id, order_number, order_type, total_weight_kg, price_per_kg, base_price, additional_charges, discount, total_price, status, payment_status, payment_method, paid_amount, received_at, ready_at, collected_at, expected_ready_date, ready_notification_sent, ready_notification_sent_at, client_notified_via, special_instructions, internal_notes, client_feedback, client_rating, created_by, created_at, updated_at, push_notification_sent, last_synced_at) FROM stdin;
1	1	\N	LDR-20251109-001	bulk_kg	5.50	3.50	19.25	0.00	0.00	19.25	ready	pending	\N	0.00	2025-11-09 10:51:00.405022	2025-11-09 12:30:51.182884	\N	\N	t	2025-11-09 12:30:51.182884	in_app	\N	\N	\N	\N	1	2025-11-09 10:51:00.405022	2025-11-09 12:30:51.182884	f	\N
2	1	\N	LDR-20251109-002	itemized	0.00	3.50	21.00	0.00	0.00	21.00	ready	pending	\N	0.00	2025-11-09 10:51:00.405022	2025-11-09 12:30:59.417428	\N	\N	t	2025-11-09 12:30:59.417428	in_app	\N	\N	\N	\N	1	2025-11-09 10:51:00.405022	2025-11-09 12:30:59.417428	f	\N
\.


--
-- Data for Name: laundry_services; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.laundry_services (id, name, service_type, base_price, unit, estimated_duration_minutes, description, is_active, created_at, updated_at) FROM stdin;
1	Wash & Fold	wash	8.00	kg	1440	Standard wash and fold service	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
2	Dry Cleaning	dry_clean	12.00	item	2880	Professional dry cleaning	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
3	Iron Only	iron	3.00	item	720	Ironing service only	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
4	Express Wash	wash	15.00	kg	180	3-hour express service	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
5	Delicate Care	special	10.00	kg	1440	Special care for delicate items	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
6	Shirt Service	wash	4.00	item	1440	Wash and iron shirts	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
7	Suit Service	dry_clean	18.00	item	2880	Dry clean and press suits	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
8	Bedding Service	wash	12.00	item	1440	Wash and fold bedding	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
9	Curtain Cleaning	special	20.00	item	2880	Professional curtain cleaning	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
10	Shoe Cleaning	special	8.00	item	1440	Professional shoe cleaning	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
11	Bag Cleaning	special	15.00	item	2880	Handbag and backpack cleaning	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
12	Alterations	special	10.00	item	\N	Basic clothing alterations	t	2025-11-09 10:51:00.404267	2025-11-09 10:51:00.404267
13	Express Wash	special	15.00	kg	180	\N	t	2025-11-09 11:05:54.816373	2025-11-09 11:05:54.816373
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.payments (id, client_id, service_type, cleaning_job_id, laundry_order_id, amount, payment_method, payment_date, tax_percentage, tax_amount, amount_before_tax, notes, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: properties; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.properties (id, client_id, property_name, address_line1, address_line2, city, postal_code, district, access_instructions, is_primary, created_at, property_type_id, updated_at) FROM stdin;
1	1	Migrated: Apartment 12B, Rua das Flores	Rua das Flores, 123	\N	Lisboa	\N	\N	\N	f	2025-11-09 20:09:56.406576	6	2025-11-09 20:09:56.406576
2	1	Test Apartment	Avenida da Liberdade, 100	\N	Lisboa	1200-001	Lisboa	\N	f	2025-11-09 20:09:56.406576	6	2025-11-09 20:09:56.406576
\.


--
-- Data for Name: property_types; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.property_types (id, type_name, description, created_at) FROM stdin;
1	casa	House/Home	2025-11-09 20:09:56.406576
2	apartamento	Apartment	2025-11-09 20:09:56.406576
3	quinta	Farm/Estate	2025-11-09 20:09:56.406576
4	escritorio	Office	2025-11-09 20:09:56.406576
5	loja	Shop/Store	2025-11-09 20:09:56.406576
6	outro	Other	2025-11-09 20:09:56.406576
\.


--
-- Data for Name: role_types; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.role_types (id, role_name, description, created_at) FROM stdin;
1	master	System owner with full access	2025-11-09 20:09:56.406576
2	admin	Manager with admin privileges	2025-11-09 20:09:56.406576
3	worker	Field worker for jobs and orders	2025-11-09 20:09:56.406576
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.session (sid, sess, expire) FROM stdin;
QX3te2p2bOvKvevKHovNx2RtthRWFoCM	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:16:14.846Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:16:15
PfbYfOz_L6tqSUeiMfy1pUpMwl9DTmjJ	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:15:41.622Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:15:42
wRjgRLKw2qae22Bir9XjiVsD0WePuvq8	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:16:37.655Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:16:38
bY9TPjZMqaL6Aah2NTDZEXyjl_6q1ZRB	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:20:23.986Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:20:25
9wJAglkfQ4dqYaKPxSxzfvuuWSNABS6e	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:17:48.820Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:17:49
mZZr5lOJAL7mi6vAE7SJn-En1qJ1eStf	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:17:10.502Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:17:11
0vEGLXa-AntwxxIC0eObTbOLR1Ln0uKe	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:15:57.943Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:15:59
b22PHPjZhOqnd4xfTpWctqyvjvUzBY2c	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:15:24.906Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:15:26
AjclpnzDcAYBvugf02VPVcr5YK1krO0g	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:16:31.703Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:16:32
zxLt327z2wozIfFJGFWOYpjOZFOex2HX	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:30.058Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:31
GON9qGABcaEl0KOyaWyuF0FXzl-VZdtp	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:17:32.651Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:17:33
qJoCbXEpDrkr5GD-xq1R-ADKQP3G7Pwl	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:16:54.311Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:16:55
sxebbbFpNV6wYbXP7sFRO0vh8ybh_of8	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:18:37.481Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:18:38
EleqYFqPTPkzPL_7Wx41ynwToFOp90-4	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:17:16.444Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:17:17
OYLqBksKppAcrExGsA7CASLFEu6vgo_H	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:18:21.240Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:18:22
NmpQVUp-hJUDTahD2tvpGeE1xT9E62I9	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:19:36.670Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:19:37
F6Qndsv04KwY0FF8eyPg7bMaVwPENtF7	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:18:05.036Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:18:06
2HdUmUAPMyqq7UFol--bOQLiLrYAuPBN	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:19:52.870Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:19:54
KuRAY0i9FQht9zXXUWdn7QaWKhEujzoV	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:21:00.902Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:21:02
m_PcvHDNVvdmEk2Dg67EA0vIoi0J5t2k	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:20:39.519Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:20:40
IINsfaFrvaBxvjf8BeS5nQ8jGDpNMQI-	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:20:08.388Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:20:09
WeBt6LiMEeYbUwxaKAGArzhxsQRxeY6l	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:34.658Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:35
2xtYDn-U6m0lvMJ7PXSSLX0xiHHaH5Oj	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:27.733Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:28
0rXCjloxXmkL9CvhC4wFQ8ialtQBNn0t	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:36.941Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:38
O-ThjVWIHukOzIoxZd_fRt6lmLbQeU35	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:32.358Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:33
FNczFaCaOvLSF7UAlEKjErKkbM3w_qPK	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:06:17.170Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 20:19:48
rkb8fhjzLVxGGNTFyUDHsAc5YOFEMir4	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:39.259Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:40
Z59QlKGlwfKRGWrDRYWKSy1Is1lxpNVl	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:41.574Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:42
f5F3_7uRYjS0uUMT3ZXgIDO71tNX4Fly	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:54:19.527Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:54:20
BUhygFxChy7de4k6JbDMKQQoQcdXIU8V	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:53:06.779Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:53:07
dxxWq-CG1GOoG4NsYsNa6DwqDYzlkIoR	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:50:48.048Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:50:49
33DCi6C-FbHQ7ep2kzufNsU6y3HT0jyH	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:43.891Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:45
I9TC57819KsWSE-hia8DG_R7bRpkaxNm	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:48:05.268Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:48:06
NFIT220ViMp0dfGu1AvC0RODDK50OMUT	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:44:47.875Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:44:49
BKcl13FoXej22W1SLvFxYBq9z1u9Mmz6	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:46.192Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:47
INlvNWphtHOAF2HGwFmjB0LhQ1gHyjTR	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:51:40.229Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:51:41
c58VQaipff-eMnhkRp-E-zbJWtSpkWqg	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:52:30.512Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:52:31
H9ArBRuFpUVsmPBQaRmmVxCo8J6ZvRIY	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:51:54.247Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:51:55
VW-3LocB_7I7BoEEp03JHdkAdH-b5uer	{"cookie":{"originalMaxAge":2591999999,"expires":"2025-12-09T11:48:17.384Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:48:18
YpR82uqlurQwl3nBLwUfa8DZTtMSn83q	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:44:55.658Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:44:56
T6iIYg5gFSocb-dtzyotSfjhVHecJrIf	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:51:24.297Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:51:25
cJMg55tDPX4u8nNZENs8N-O5zuZv3xw9	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:52:18.430Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:52:19
hCD-HOAb7TVvsPmaLXR1NCAy1UjzRDJu	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:51:42.132Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:51:43
94_bnqoZ_hZnILz9WjxVRQfZ5fnPvIqb	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:54:31.575Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:54:32
BCH_UbncGXSHbBuk5SMLhz8h_YQGaVrV	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:59:53.346Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:59:54
PadaC6fe-zn5QUMLPRzJLRrVfyNdT_cy	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:52:06.315Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:52:07
0w_Tadbn2Ke3kxYu11ZGevtw8MEZVYal	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:53:30.910Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:53:32
o3TTc_zvbc5-M_8Xe9Bqh_cbFbBjT13G	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:53:18.862Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:53:19
MtAVZO36JxuVBcJHUy3VoGqH_jc5896O	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:58:53.101Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:58:54
fpgBkmmgQTkzZV1hle77qROKcgxZtd89	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:54:07.443Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:54:08
QtxzU4-MxR1oYFTdyPr1s8TrbbtK1YCx	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:57:16.886Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:57:18
H9u2Bo1qQ8GSTRr8CXSvjT-fe6ATBiAZ	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:59:17.132Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:59:18
OAKgaos2Cc7OtiAbVIl0LxsBDqjbEz14	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:59:05.116Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:59:06
_GGhLAseNbFrKQtzFlFz2PKqDKAIsRsG	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:00:42.092Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 12:00:46
KYUnmL6IWVOx-FRf3Hh7Q1K8qTFmhmgh	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:05:20.797Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 12:05:21
DEWBbL-aLN8tEVn-mlwXecbx9_I8krap	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:07.003Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 12:10:08
OYyD8KiOo8vfRyToYQ89Dn_mV_gaqKk3	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:51:36.394Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:51:37
x6v9DlABjDePax3mVnpggGXgTqi5NmA-	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:50:23.850Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:50:24
jdtGBfKsgFeiUfI8jXW8Dn9sDZ-XFx1P	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:48.507Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:49
jKR4pN9W8fXx5zn02jU88wVoNqOLfyfL	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:49:05.701Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:49:06
9caHj9dpjLFOTNXcgrHH_R-T0JA8AaJu	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:47:39.852Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:47:40
Bvj_hGi4JMuRdm2s0OKWYl_NRURPZAhs	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:47:28.386Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:47:29
pzsMq6gvrMSrRntm5WkYRoCu1DqL8W-4	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:50.209Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:51
_wllNuzskENG_CqtRBL9gjT9Ks-dIAhC	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:44:49.560Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:44:50
Xa87oAKElXjpkGEXd51STELuxD_NwhVv	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:59.407Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:32:00
z6LkQCEEu4GmvXUDxKonb3TxEaCVZkuQ	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:47:53.137Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:47:54
CEKecbqAfOMUMrX-jN3oS7j2HJcF5h0B	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:51:38.278Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:51:39
O36xDTP8W0oboOBuymHr-oDv_qMQ1Kpm	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:48:41.567Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:48:42
xi62kIJWK2kURzpAtZTp37NBzf4GP84p	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:47:36.087Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:47:37
Nv8_16vAsv6G3EnRTbaKBKReaVuaeDJU	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:47:16.854Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:47:17
S809p0a-ZxXEi4kF4OENiaKC1Yz6cBJ1	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:49:54.100Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:49:55
ktNn9nDtsAEqfl1wf5ppYCl97XSGKSHe	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:47:44.802Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:47:45
nrMYKgVjfgg44UzR9x6T2Yv2wGyspxoY	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:49:42.015Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:49:43
Wa1x3WeRZxaRckbsQPHDHgXTBR9Utk66	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:49:29.898Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:49:31
JJAg2m85rjZcnEGyF8jgHA52HG93XCgt	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:48:29.516Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:48:30
l3LaZtlQNoQ3geUahFOq-nd2EBL4L3U3	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:49:17.816Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:49:18
nBofC8MdIuLlxJMM03clkVEH675lDzwY	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:50:06.181Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:50:07
bkn0CG1r9jlS-hSYbNKkVOkTUBKvNINO	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:51:12.230Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:51:13
ResXwdArId7hqc068aGVzYf-N6TRSKkf	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:50:18.264Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:50:19
brvoPHyX8tzYoA3MvoBKrj6bIQiyIybG	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:51:00.149Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:51:01
1mIYREK4YoB3JENc6vcZIrEFmMtbkUjH	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:54:55.672Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:54:56
i4d9y1U_Tqxsy0WvEBBwjWP_2upDRnPy	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:54:43.625Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:54:44
MLnnazbz0TBsSMUbVlQoX1M1RqcAUh-e	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:55:07.740Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:55:08
2jp7jemviwXppOJuo-yApm3OwzFWQ4uU	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:57:41.055Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:57:42
qoPBhHX85o8zUDbIasBWpIT6I9l4N6k2	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:52:42.594Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:52:43
5pi1cEMa67uMGti_YjGJ-o8MBgaBqD7f	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:44:53.391Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:44:54
sOQVZk_B67-PRLi_6-YmVaGc0cucOUGp	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:32:04.009Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:32:05
HvWKJzpDlVXXtZlDE034nbkEoQD9Ae0p	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:52.457Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:53
lxUcDjN-2Zhr6RczpUdfs-waHgXQ5gyd	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:48:53.651Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:48:54
Z_1ndWUNSzNPGLKwlTaMzu0Lnx0T_0Ej	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:54.807Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:55
KZnjgnI7hFQcHMVQ1K8kZA9pPzJW9S86	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:32:06.289Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:32:07
-ki2k_XYZPl-gIgUKMi6JfTaYpczPfey	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:50:35.903Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:50:37
8Fu0Xs97KkQxKKQeZMMUlubHPklxACR-	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:31:57.092Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:31:58
2u9zb-yhafBWrVUadtcMavXEahMFkaqE	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:44:51.191Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:44:52
jzfNS3gLEVSNeVkILl5XyWD5aRUrYzYm	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:57:04.817Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:57:05
XXiAYL6fVFVPYGmbUXDHwh2YcjVXRB2s	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:32:01.707Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:32:02
i78B6iiSn4hXlYq1qaKGdqdhDUVghblw	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:32:08.557Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 11:32:09
vc7uGQGKWNZg7tQqr3PqIQgNczP19RrN	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:47:23.418Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:47:24
oD24vJMOE5BEktkAGjQ8UEVjlkIYevWr	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:50:21.996Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:50:23
auXkrwSSq8PN8jXV0wAhIX_vzUYD5xr3	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:58:17.069Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:58:18
NbWLIuLFzjIRH4TUR_NseKZdBzqTTjxP	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:50:20.130Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:50:21
OULjk2TImUsL04M1Tkmku8AV7z7ITk2b	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:57:28.986Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:57:30
RIwUKSIwxNJi5VnmGppye51ykAmOSJ7Z	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:52:54.696Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:52:55
HmJ2YIxaA5madGlsTSZPkyE6iqToccxv	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:53:43.096Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:53:44
nLm9Alzh0fTOkLnYtAXMEUjjP-Qakzww	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:53:55.276Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:53:56
_X6nC-KN5phKVV4nRSOu8B57Y9hD2mUZ	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:58:29.086Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:58:30
p1JBrhBNxxh-713Lf27PouOnr4sf8Guj	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:58:05.051Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:58:06
u6JKgxu1Uic41vh14ne6YlJ9eoOBBZYn	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:57:53.089Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:57:54
CMogRXdnvgUCoHhhfTMiJ0VBkTZPZVCl	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:58:41.083Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 11:58:42
99fxF78p_jM9wDAiy-2Vj2Imn7RLSpn7	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:59:29.165Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:59:30
Xi7R5FKRO09vbAbOvvZFBmQNQgYnYtu0	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T11:59:41.250Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2,"userType":"admin","userName":"Administrator"}	2025-12-09 11:59:42
U_53pZt5CYX-XywOV0h3kVnXPhd82h9g	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:53.101Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:54
zjAhHAuuwpu0twalgAg4Jz5p-iyGEpGI	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:28.753Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:29
ddr9u5qnwrD2M3YvE5vfY6KVi7o2LNdn	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:48.551Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:49
PttfBekVr432mifq7dL5zeABTiLNDzEP	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:37.805Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:38
XWkWz9O3INig7LtLuurAHRJBG3CWXqxS	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:17.119Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"userType":"master","userName":"Master Admin"}	2025-12-09 12:10:18
6td3DN22SolXdJUIoIysH7U1v1H4ZawA	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:31.035Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:32
Vuu30vTOhBl9Y6CJlpIHtxLQ25quEwNk	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:44.618Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:45
ur1yKHxL-MDPmmd9KhaDlmPYuqKFQfmN	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:24.236Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:25
Zya96tkoFBEIO3q5yDZPCOAnO6j7il3i	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:11:04.450Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:11:05
zS8MkLIRAzvzZ5kuJLkNirhkocf71yAp	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:11:02.200Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:11:03
UiOeLto45OIYgsqOJaKECpUoR-45jq0L	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:33.302Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:34
2N4zbH7YGvhGzOCOdLmr3Lts5OU3xRYo	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:26.486Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:27
tLtXVRW5RDfZpSTZaIs2dSi1f_sLUtGl	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:40.085Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:41
lGycGIrkrFz1WKk1RPzRWyREfAo7I87g	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:55.367Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:56
nk1TcmIyq4HahTeecVFp3W3-f1ha1Nwa	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:50.835Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:51
OF2ye2av_ZE-g3W_oEJRaqLG04GP7nKk	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:46.285Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:47
Jr9oAAhyqiFYmQV2pLLjqeEyg7hObaGi	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:35.553Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:36
VqmWxNxzyxhPu0CaYriv6KuHNKvDcmu9	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:42.352Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:43
Rom91xj0XWAJq5e9qezINEQb5-ytXlRw	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:59.916Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:11:01
mKH3IL0P0XDykDB6rM_tMX8CAqy1dzMT	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-12-09T12:10:57.651Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":3,"userType":"worker","userName":"Maria Silva"}	2025-12-09 12:10:58
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.tickets (id, title, description, service_type, order_id, priority, status, created_by, assigned_to, resolved_at, resolved_by, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lavandaria
--

COPY public.users (id, username, password, email, phone, date_of_birth, nif, address_line1, address_line2, city, postal_code, district, created_at, updated_at, is_active, created_by, name, role_id) FROM stdin;
1	master	$2b$10$iyoWMyQRwUrseBPEUOvu6.9xMRJ4d6RCjIbfv/OpollcbeMQWiU.e	master@lavandaria.com	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-09 10:51:00.400198	2025-11-09 20:09:56.406576	t	\N	Master Admin	1
2	admin	$2b$10$AC7dVLo.KeW3YgIeveZ9C.Dy/qmDxQhoDtvf0Q2vW2k/EZyy8uNEy	admin@lavandaria.com	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-09 10:51:00.400198	2025-11-09 20:09:56.406576	t	1	Administrator	2
3	worker1	$2b$10$5TBBvMz.csBeXlp/isBgnuMi8xlMGywuot8VUxN5QaP5Qz7ELYZJW	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-09 10:51:00.400198	2025-11-09 20:09:56.406576	t	1	Maria Silva	3
\.


--
-- Name: cleaning_job_photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.cleaning_job_photos_id_seq', 1, false);


--
-- Name: cleaning_job_workers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.cleaning_job_workers_id_seq', 1, true);


--
-- Name: cleaning_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.cleaning_jobs_id_seq', 5, true);


--
-- Name: cleaning_time_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.cleaning_time_logs_id_seq', 1, false);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.clients_id_seq', 1, true);


--
-- Name: job_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.job_notifications_id_seq', 2, true);


--
-- Name: laundry_order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.laundry_order_items_id_seq', 1, false);


--
-- Name: laundry_orders_new_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.laundry_orders_new_id_seq', 2, true);


--
-- Name: laundry_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.laundry_services_id_seq', 13, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


--
-- Name: properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.properties_id_seq', 2, true);


--
-- Name: property_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.property_types_id_seq', 6, true);


--
-- Name: role_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.role_types_id_seq', 3, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.tickets_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lavandaria
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: cleaning_job_photos cleaning_job_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_photos
    ADD CONSTRAINT cleaning_job_photos_pkey PRIMARY KEY (id);


--
-- Name: cleaning_job_workers cleaning_job_workers_cleaning_job_id_worker_id_key; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_workers
    ADD CONSTRAINT cleaning_job_workers_cleaning_job_id_worker_id_key UNIQUE (cleaning_job_id, worker_id);


--
-- Name: cleaning_job_workers cleaning_job_workers_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_workers
    ADD CONSTRAINT cleaning_job_workers_pkey PRIMARY KEY (id);


--
-- Name: cleaning_jobs cleaning_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_jobs
    ADD CONSTRAINT cleaning_jobs_pkey PRIMARY KEY (id);


--
-- Name: cleaning_time_logs cleaning_time_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_time_logs
    ADD CONSTRAINT cleaning_time_logs_pkey PRIMARY KEY (id);


--
-- Name: clients clients_phone_key; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_phone_key UNIQUE (phone);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: job_notifications job_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.job_notifications
    ADD CONSTRAINT job_notifications_pkey PRIMARY KEY (id);


--
-- Name: laundry_order_items laundry_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_order_items
    ADD CONSTRAINT laundry_order_items_pkey PRIMARY KEY (id);


--
-- Name: laundry_orders_new laundry_orders_new_order_number_key; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_orders_new
    ADD CONSTRAINT laundry_orders_new_order_number_key UNIQUE (order_number);


--
-- Name: laundry_orders_new laundry_orders_new_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_orders_new
    ADD CONSTRAINT laundry_orders_new_pkey PRIMARY KEY (id);


--
-- Name: laundry_services laundry_services_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_services
    ADD CONSTRAINT laundry_services_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: property_types property_types_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.property_types
    ADD CONSTRAINT property_types_pkey PRIMARY KEY (id);


--
-- Name: property_types property_types_type_name_key; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.property_types
    ADD CONSTRAINT property_types_type_name_key UNIQUE (type_name);


--
-- Name: role_types role_types_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.role_types
    ADD CONSTRAINT role_types_pkey PRIMARY KEY (id);


--
-- Name: role_types role_types_role_name_key; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.role_types
    ADD CONSTRAINT role_types_role_name_key UNIQUE (role_name);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_cleaning_jobs_client; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_cleaning_jobs_client ON public.cleaning_jobs USING btree (client_id);


--
-- Name: idx_cleaning_jobs_date; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_cleaning_jobs_date ON public.cleaning_jobs USING btree (scheduled_date);


--
-- Name: idx_cleaning_jobs_property; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_cleaning_jobs_property ON public.cleaning_jobs USING btree (property_id);


--
-- Name: idx_cleaning_jobs_status; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_cleaning_jobs_status ON public.cleaning_jobs USING btree (status);


--
-- Name: idx_cleaning_jobs_type; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_cleaning_jobs_type ON public.cleaning_jobs USING btree (job_type);


--
-- Name: idx_cleaning_jobs_worker; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_cleaning_jobs_worker ON public.cleaning_jobs USING btree (assigned_worker_id);


--
-- Name: idx_clients_is_active; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_clients_is_active ON public.clients USING btree (is_active);


--
-- Name: idx_clients_is_enterprise; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_clients_is_enterprise ON public.clients USING btree (is_enterprise);


--
-- Name: idx_clients_phone; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_clients_phone ON public.clients USING btree (phone);


--
-- Name: idx_job_workers_job; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_job_workers_job ON public.cleaning_job_workers USING btree (cleaning_job_id);


--
-- Name: idx_job_workers_worker; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_job_workers_worker ON public.cleaning_job_workers USING btree (worker_id);


--
-- Name: idx_laundry_items_order; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_laundry_items_order ON public.laundry_order_items USING btree (laundry_order_id);


--
-- Name: idx_laundry_items_type; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_laundry_items_type ON public.laundry_order_items USING btree (item_type);


--
-- Name: idx_laundry_orders_client; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_laundry_orders_client ON public.laundry_orders_new USING btree (client_id);


--
-- Name: idx_laundry_orders_number; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_laundry_orders_number ON public.laundry_orders_new USING btree (order_number);


--
-- Name: idx_laundry_orders_status; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_laundry_orders_status ON public.laundry_orders_new USING btree (status);


--
-- Name: idx_laundry_orders_worker; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_laundry_orders_worker ON public.laundry_orders_new USING btree (assigned_worker_id);


--
-- Name: idx_notifications_client; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_notifications_client ON public.job_notifications USING btree (client_id);


--
-- Name: idx_notifications_status; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_notifications_status ON public.job_notifications USING btree (status);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_notifications_type ON public.job_notifications USING btree (notification_type);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_notifications_user ON public.job_notifications USING btree (user_id);


--
-- Name: idx_payments_client; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_client ON public.payments USING btree (client_id);


--
-- Name: idx_payments_date; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_date ON public.payments USING btree (payment_date);


--
-- Name: idx_payments_method; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_method ON public.payments USING btree (payment_method);


--
-- Name: idx_payments_service_type; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_service_type ON public.payments USING btree (service_type);


--
-- Name: idx_photos_job; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_photos_job ON public.cleaning_job_photos USING btree (cleaning_job_id);


--
-- Name: idx_photos_type; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_photos_type ON public.cleaning_job_photos USING btree (photo_type);


--
-- Name: idx_properties_client; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_properties_client ON public.properties USING btree (client_id);


--
-- Name: idx_properties_type; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_properties_type ON public.properties USING btree (property_type_id);


--
-- Name: idx_tickets_assigned_to; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_tickets_assigned_to ON public.tickets USING btree (assigned_to);


--
-- Name: idx_tickets_created_by; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_tickets_created_by ON public.tickets USING btree (created_by);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);


--
-- Name: idx_time_logs_job; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_time_logs_job ON public.cleaning_time_logs USING btree (cleaning_job_id);


--
-- Name: idx_time_logs_worker; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_time_logs_worker ON public.cleaning_time_logs USING btree (worker_id);


--
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: cleaning_jobs trigger_calculate_cleaning_cost; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_calculate_cleaning_cost BEFORE INSERT OR UPDATE ON public.cleaning_jobs FOR EACH ROW EXECUTE FUNCTION public.calculate_cleaning_job_cost();


--
-- Name: laundry_orders_new trigger_calculate_laundry_total; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_calculate_laundry_total BEFORE INSERT OR UPDATE ON public.laundry_orders_new FOR EACH ROW EXECUTE FUNCTION public.calculate_laundry_total();


--
-- Name: payments trigger_calculate_payment_tax; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_calculate_payment_tax BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.calculate_payment_tax();


--
-- Name: cleaning_jobs trigger_update_cleaning_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_update_cleaning_jobs_updated_at BEFORE UPDATE ON public.cleaning_jobs FOR EACH ROW EXECUTE FUNCTION public.update_cleaning_jobs_updated_at();


--
-- Name: laundry_orders_new trigger_update_laundry_orders_updated_at; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_update_laundry_orders_updated_at BEFORE UPDATE ON public.laundry_orders_new FOR EACH ROW EXECUTE FUNCTION public.update_laundry_orders_updated_at();


--
-- Name: properties trigger_update_properties_updated_at; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();


--
-- Name: users trigger_update_users_updated_at; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_updated_at();


--
-- Name: cleaning_job_photos cleaning_job_photos_cleaning_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_photos
    ADD CONSTRAINT cleaning_job_photos_cleaning_job_id_fkey FOREIGN KEY (cleaning_job_id) REFERENCES public.cleaning_jobs(id) ON DELETE CASCADE;


--
-- Name: cleaning_job_photos cleaning_job_photos_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_photos
    ADD CONSTRAINT cleaning_job_photos_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cleaning_job_workers cleaning_job_workers_cleaning_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_workers
    ADD CONSTRAINT cleaning_job_workers_cleaning_job_id_fkey FOREIGN KEY (cleaning_job_id) REFERENCES public.cleaning_jobs(id) ON DELETE CASCADE;


--
-- Name: cleaning_job_workers cleaning_job_workers_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_job_workers
    ADD CONSTRAINT cleaning_job_workers_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cleaning_jobs cleaning_jobs_assigned_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_jobs
    ADD CONSTRAINT cleaning_jobs_assigned_worker_id_fkey FOREIGN KEY (assigned_worker_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cleaning_jobs cleaning_jobs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_jobs
    ADD CONSTRAINT cleaning_jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: cleaning_jobs cleaning_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_jobs
    ADD CONSTRAINT cleaning_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cleaning_time_logs cleaning_time_logs_cleaning_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_time_logs
    ADD CONSTRAINT cleaning_time_logs_cleaning_job_id_fkey FOREIGN KEY (cleaning_job_id) REFERENCES public.cleaning_jobs(id) ON DELETE CASCADE;


--
-- Name: cleaning_time_logs cleaning_time_logs_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_time_logs
    ADD CONSTRAINT cleaning_time_logs_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cleaning_jobs fk_cleaning_jobs_property; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.cleaning_jobs
    ADD CONSTRAINT fk_cleaning_jobs_property FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;


--
-- Name: properties fk_properties_type; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT fk_properties_type FOREIGN KEY (property_type_id) REFERENCES public.property_types(id) ON DELETE SET NULL;


--
-- Name: users fk_users_role_type; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_role_type FOREIGN KEY (role_id) REFERENCES public.role_types(id) ON DELETE RESTRICT;


--
-- Name: job_notifications job_notifications_cleaning_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.job_notifications
    ADD CONSTRAINT job_notifications_cleaning_job_id_fkey FOREIGN KEY (cleaning_job_id) REFERENCES public.cleaning_jobs(id) ON DELETE CASCADE;


--
-- Name: job_notifications job_notifications_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.job_notifications
    ADD CONSTRAINT job_notifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: job_notifications job_notifications_laundry_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.job_notifications
    ADD CONSTRAINT job_notifications_laundry_order_id_fkey FOREIGN KEY (laundry_order_id) REFERENCES public.laundry_orders_new(id) ON DELETE CASCADE;


--
-- Name: job_notifications job_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.job_notifications
    ADD CONSTRAINT job_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: laundry_order_items laundry_order_items_laundry_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_order_items
    ADD CONSTRAINT laundry_order_items_laundry_order_id_fkey FOREIGN KEY (laundry_order_id) REFERENCES public.laundry_orders_new(id) ON DELETE CASCADE;


--
-- Name: laundry_orders_new laundry_orders_new_assigned_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_orders_new
    ADD CONSTRAINT laundry_orders_new_assigned_worker_id_fkey FOREIGN KEY (assigned_worker_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: laundry_orders_new laundry_orders_new_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_orders_new
    ADD CONSTRAINT laundry_orders_new_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: laundry_orders_new laundry_orders_new_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.laundry_orders_new
    ADD CONSTRAINT laundry_orders_new_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: payments payments_cleaning_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_cleaning_job_id_fkey FOREIGN KEY (cleaning_job_id) REFERENCES public.cleaning_jobs(id) ON DELETE CASCADE;


--
-- Name: payments payments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payments payments_laundry_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_laundry_order_id_fkey FOREIGN KEY (laundry_order_id) REFERENCES public.laundry_orders_new(id) ON DELETE CASCADE;


--
-- Name: properties properties_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict cp7IVSEHCqujWJeiLDpU2ADVEm1pm29r6yr4oSS7Sh9sTKJFzyumHkrh9gZhv07


--
-- PostgreSQL database dump
--

\restrict 1hHXNjxDWYkrrMUE3VApIqUwdKmt9qhF6ofnIxUpM4py7GaJU2aKxdLN8INmB5L

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
    property_name character varying(200),
    property_address text NOT NULL,
    address_line1 character varying(200) NOT NULL,
    address_line2 character varying(200),
    city character varying(100) NOT NULL,
    postal_code character varying(20),
    district character varying(100),
    country character varying(100) DEFAULT 'Portugal'::character varying,
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
    payment_method character varying(50),
    paid_amount numeric(10,2) DEFAULT 0,
    notes text,
    special_instructions text,
    client_feedback text,
    client_rating integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    push_notification_sent boolean DEFAULT false,
    client_viewed_photos boolean DEFAULT false,
    last_synced_at timestamp without time zone,
    CONSTRAINT cleaning_jobs_client_rating_check CHECK (((client_rating >= 1) AND (client_rating <= 5))),
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
    full_name character varying(100) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    email character varying(100),
    date_of_birth date,
    nif character varying(20),
    address_line1 character varying(200),
    address_line2 character varying(200),
    city character varying(100),
    postal_code character varying(20),
    district character varying(100),
    country character varying(100) DEFAULT 'Portugal'::character varying,
    notes text,
    is_enterprise boolean DEFAULT false,
    company_name character varying(200),
    registration_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    must_change_password boolean DEFAULT true
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
-- Name: payments_cleaning; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.payments_cleaning (
    id integer NOT NULL,
    cleaning_job_id integer NOT NULL,
    client_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(20) NOT NULL,
    payment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payments_cleaning_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'transfer'::character varying, 'mbway'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.payments_cleaning OWNER TO lavandaria;

--
-- Name: TABLE payments_cleaning; Type: COMMENT; Schema: public; Owner: lavandaria
--

COMMENT ON TABLE public.payments_cleaning IS 'Payments for cleaning jobs with FK to cleaning_jobs';


--
-- Name: payments_cleaning_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.payments_cleaning_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_cleaning_id_seq OWNER TO lavandaria;

--
-- Name: payments_cleaning_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.payments_cleaning_id_seq OWNED BY public.payments_cleaning.id;


--
-- Name: payments_laundry; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.payments_laundry (
    id integer NOT NULL,
    laundry_order_id integer NOT NULL,
    client_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(20) NOT NULL,
    payment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payments_laundry_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'transfer'::character varying, 'mbway'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.payments_laundry OWNER TO lavandaria;

--
-- Name: TABLE payments_laundry; Type: COMMENT; Schema: public; Owner: lavandaria
--

COMMENT ON TABLE public.payments_laundry IS 'Payments for laundry orders with FK to laundry_orders_new';


--
-- Name: payments_laundry_id_seq; Type: SEQUENCE; Schema: public; Owner: lavandaria
--

CREATE SEQUENCE public.payments_laundry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_laundry_id_seq OWNER TO lavandaria;

--
-- Name: payments_laundry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lavandaria
--

ALTER SEQUENCE public.payments_laundry_id_seq OWNED BY public.payments_laundry.id;


--
-- Name: properties; Type: TABLE; Schema: public; Owner: lavandaria
--

CREATE TABLE public.properties (
    id integer NOT NULL,
    client_id integer NOT NULL,
    name character varying(200),
    address_line1 character varying(200) NOT NULL,
    address_line2 character varying(200),
    city character varying(100) NOT NULL,
    postal_code character varying(20),
    district character varying(100),
    country character varying(100) DEFAULT 'Portugal'::character varying,
    property_type character varying(50),
    access_instructions text,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
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
    order_type character varying(20),
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
    CONSTRAINT tickets_order_type_check CHECK (((order_type)::text = ANY ((ARRAY['laundry'::character varying, 'cleaning'::character varying, 'general'::character varying])::text[]))),
    CONSTRAINT tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
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
    role character varying(20) NOT NULL,
    full_name character varying(100) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    email character varying(100),
    phone character varying(20),
    date_of_birth date,
    nif character varying(20),
    address_line1 character varying(200),
    address_line2 character varying(200),
    city character varying(100),
    postal_code character varying(20),
    district character varying(100),
    country character varying(100) DEFAULT 'Portugal'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    registration_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    created_by integer,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['master'::character varying, 'admin'::character varying, 'worker'::character varying])::text[])))
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
-- Name: payments_cleaning id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments_cleaning ALTER COLUMN id SET DEFAULT nextval('public.payments_cleaning_id_seq'::regclass);


--
-- Name: payments_laundry id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments_laundry ALTER COLUMN id SET DEFAULT nextval('public.payments_laundry_id_seq'::regclass);


--
-- Name: properties id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.properties ALTER COLUMN id SET DEFAULT nextval('public.properties_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


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
-- Name: payments_cleaning payments_cleaning_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments_cleaning
    ADD CONSTRAINT payments_cleaning_pkey PRIMARY KEY (id);


--
-- Name: payments_laundry payments_laundry_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments_laundry
    ADD CONSTRAINT payments_laundry_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


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
-- Name: idx_payments_cleaning_client; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_cleaning_client ON public.payments_cleaning USING btree (client_id);


--
-- Name: idx_payments_cleaning_date; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_cleaning_date ON public.payments_cleaning USING btree (payment_date);


--
-- Name: idx_payments_cleaning_job; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_cleaning_job ON public.payments_cleaning USING btree (cleaning_job_id);


--
-- Name: idx_payments_laundry_client; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_laundry_client ON public.payments_laundry USING btree (client_id);


--
-- Name: idx_payments_laundry_date; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_laundry_date ON public.payments_laundry USING btree (payment_date);


--
-- Name: idx_payments_laundry_order; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_payments_laundry_order ON public.payments_laundry USING btree (laundry_order_id);


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
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: lavandaria
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


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
-- Name: cleaning_jobs trigger_update_cleaning_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_update_cleaning_jobs_updated_at BEFORE UPDATE ON public.cleaning_jobs FOR EACH ROW EXECUTE FUNCTION public.update_cleaning_jobs_updated_at();


--
-- Name: laundry_orders_new trigger_update_laundry_orders_updated_at; Type: TRIGGER; Schema: public; Owner: lavandaria
--

CREATE TRIGGER trigger_update_laundry_orders_updated_at BEFORE UPDATE ON public.laundry_orders_new FOR EACH ROW EXECUTE FUNCTION public.update_laundry_orders_updated_at();


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
-- Name: payments_cleaning payments_cleaning_cleaning_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments_cleaning
    ADD CONSTRAINT payments_cleaning_cleaning_job_id_fkey FOREIGN KEY (cleaning_job_id) REFERENCES public.cleaning_jobs(id) ON DELETE CASCADE;


--
-- Name: payments_cleaning payments_cleaning_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments_cleaning
    ADD CONSTRAINT payments_cleaning_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: payments_laundry payments_laundry_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments_laundry
    ADD CONSTRAINT payments_laundry_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: payments_laundry payments_laundry_laundry_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lavandaria
--

ALTER TABLE ONLY public.payments_laundry
    ADD CONSTRAINT payments_laundry_laundry_order_id_fkey FOREIGN KEY (laundry_order_id) REFERENCES public.laundry_orders_new(id) ON DELETE CASCADE;


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

\unrestrict 1hHXNjxDWYkrrMUE3VApIqUwdKmt9qhF6ofnIxUpM4py7GaJU2aKxdLN8INmB5L


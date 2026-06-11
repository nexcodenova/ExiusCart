from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product, Category
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from app.models.subscription import Subscription, Plan
from app.models.product_fields import ShopField, ProductAttribute, ProductImage
from app.models.lead import Lead
from app.models.affiliate import Affiliate, Commission
from app.models.supplier import Supplier, PurchaseOrder, PurchaseOrderItem
from app.models.webhook import Webhook, WebhookLog
from app.models.hr import Employee, PayrollRecord, LeaveRequest
from app.models.marketing import EmailCampaign, SMSCampaign, Event, Survey, SurveyQuestion
from app.models.recruitment import JobPosition, Applicant
from app.models.attendance import AttendanceRecord
from app.models.fleet import Vehicle, VehicleService
from app.models.services import Project, Task, HelpdeskTicket, Appointment
from app.models.shopify_integration import ShopifyStore, ShopifyWebhook, ShopifySyncLog
from app.models.partner import PartnerLicense
from app.models.channel import ChannelConnection
from app.models.channel_order_meta import ChannelOrderMeta
from app.models.channel_product_status import ChannelProductStatus
from app.models.channel_category import ChannelCategory, ProductChannelCategory
from app.models.product_variant import ProductVariant

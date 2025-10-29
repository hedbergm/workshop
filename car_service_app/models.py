from datetime import datetime
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class Vehicle(db.Model):
    __tablename__ = 'vehicles'
    id = db.Column(db.Integer, primary_key=True)
    regnr = db.Column(db.String(32), unique=True, nullable=False)
    make = db.Column(db.String(64), nullable=False)
    vtype = db.Column(db.String(64), nullable=False)
    model = db.Column(db.String(64), nullable=False)
    purchase_price = db.Column(db.Float, nullable=True)
    sale_price = db.Column(db.Float, nullable=True)
    sold_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    entries = db.relationship('ServiceEntry', backref='vehicle', cascade='all, delete-orphan', lazy='joined')

    def __repr__(self):
        return f'<Vehicle {self.regnr}>'


class ServiceEntry(db.Model):
    __tablename__ = 'service_entries'
    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow, nullable=False)
    category = db.Column(db.String(16), default='service', nullable=False)  # 'service' or 'repair'
    description = db.Column(db.Text, default='', nullable=False)
    cost = db.Column(db.Float, default=0.0, nullable=False)
    odometer = db.Column(db.Integer, default=0, nullable=False)

    def __repr__(self):
        return f'<ServiceEntry {self.category} {self.cost}>'
